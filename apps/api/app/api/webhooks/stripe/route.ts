// app/api/webhooks/stripe/route.ts

import { NextRequest, NextResponse } from "next/server";
import { headers } from "next/headers";
import Stripe from "stripe";
import { stripe, STRIPE_WEBHOOK_SECRET } from "@/lib/stripe";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const headersList = await headers();
    const signature = headersList.get("stripe-signature");

    let event: Stripe.Event;

    // DEVELOPMENT: Skip signature verification if no signature provided
    if (!signature && process.env.NODE_ENV === "development") {
      console.log("⚠️ DEV MODE: Skipping signature verification");
      event = JSON.parse(body);
    } else {
      // PRODUCTION: Verify signature
      if (!signature) {
        return NextResponse.json(
          { error: "Missing stripe-signature header" },
          { status: 400 },
        );
      }

      try {
        event = stripe.webhooks.constructEvent(
          body,
          signature,
          STRIPE_WEBHOOK_SECRET,
        );
      } catch (err) {
        console.error("Webhook signature verification failed:", err);
        return NextResponse.json(
          { error: "Invalid signature" },
          { status: 400 },
        );
      }
    }

    // Handle different event types
    switch (event.type) {
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object);
        break;

      case "customer.subscription.updated":
        await handleSubscriptionUpdated(event.data.object);
        break;

      case "customer.subscription.deleted":
        await handleSubscriptionDeleted(event.data.object);
        break;

      case "invoice.payment_succeeded":
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case "invoice.payment_failed":
        await handleInvoicePaymentFailed(event.data.object);
        break;

      case "checkout.session.completed":
        await handleCheckoutSessionCompleted(event.data.object);
        break;

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true }, { status: 200 });
  } catch (error) {
    console.error("Webhook error:", error);
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }
}

/**
 * Handle subscription created
 */
async function handleSubscriptionCreated(subscriptionData: any) {
  // Cast to any first, then access properties
  const subscription = subscriptionData as {
    id: string;
    customer: string;
    status: string;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    canceled_at: number | null;
    trial_start: number | null;
    trial_end: number | null;
    items: {
      data: Array<{
        price: {
          id: string;
        };
      }>;
    };
  };

  const customerId = subscription.customer;
  const userId = await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error("User not found for customer:", customerId);
    return;
  }

  await prisma.subscription.create({
    data: {
      userId,
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: customerId,
      stripePriceId: subscription.items.data[0].price.id,
      status: subscription.status as any,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      trialStart: subscription.trial_start
        ? new Date(subscription.trial_start * 1000)
        : null,
      trialEnd: subscription.trial_end
        ? new Date(subscription.trial_end * 1000)
        : null,
    },
  });

  console.log(`Subscription created for user ${userId}`);
}

/**
 * Handle subscription updated
 */
async function handleSubscriptionUpdated(subscriptionData: any) {
  const subscription = subscriptionData as {
    id: string;
    customer: string;
    status: string;
    current_period_start: number;
    current_period_end: number;
    cancel_at_period_end: boolean;
    canceled_at: number | null;
    items: {
      data: Array<{
        price: {
          id: string;
        };
      }>;
    };
  };

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: subscription.status as any,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      canceledAt: subscription.canceled_at
        ? new Date(subscription.canceled_at * 1000)
        : null,
      stripePriceId: subscription.items.data[0].price.id,
      updatedAt: new Date(),
    },
  });

  console.log(`Subscription updated: ${subscription.id}`);
}

/**
 * Handle subscription deleted
 */
async function handleSubscriptionDeleted(subscriptionData: any) {
  const subscription = subscriptionData as {
    id: string;
  };

  await prisma.subscription.update({
    where: { stripeSubscriptionId: subscription.id },
    data: {
      status: "canceled",
      canceledAt: new Date(),
      updatedAt: new Date(),
    },
  });

  console.log(`Subscription deleted: ${subscription.id}`);
}

/**
 * Handle successful invoice payment
 */
async function handleInvoicePaymentSucceeded(invoiceData: any) {
  const invoice = invoiceData as {
    id: string;
    customer: string;
    subscription: string | null;
    amount_paid: number;
    amount_due: number;
    currency: string;
    payment_intent: string | null;
    description: string | null;
    hosted_invoice_url: string | null;
  };

  const customerId = invoice.customer;
  const userId = await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error("User not found for customer:", customerId);
    return;
  }

  const subscriptionId = invoice.subscription
    ? await getSubscriptionId(invoice.subscription)
    : null;

  // Get or create payment record
  const existingPayment = invoice.payment_intent
    ? await prisma.payment.findUnique({
        where: { stripePaymentId: invoice.payment_intent },
      })
    : null;

  if (existingPayment) {
    await prisma.payment.update({
      where: { stripePaymentId: invoice.payment_intent! },
      data: {
        status: "succeeded",
        receiptUrl: invoice.hosted_invoice_url,
        updatedAt: new Date(),
      },
    });
  } else {
    await prisma.payment.create({
      data: {
        userId,
        subscriptionId,
        stripePaymentId: invoice.payment_intent || invoice.id,
        stripeInvoiceId: invoice.id,
        amount: invoice.amount_paid,
        currency: invoice.currency,
        status: "succeeded",
        description: invoice.description || "Subscription payment",
        receiptUrl: invoice.hosted_invoice_url,
      },
    });
  }

  console.log(`Payment succeeded for invoice ${invoice.id}`);
}

/**
 * Handle failed invoice payment
 */
async function handleInvoicePaymentFailed(invoiceData: any) {
  const invoice = invoiceData as {
    id: string;
    customer: string;
    subscription: string | null;
    amount_due: number;
    currency: string;
    payment_intent: string | null;
    description: string | null;
  };

  const customerId = invoice.customer;
  const userId = await getUserIdFromCustomer(customerId);

  if (!userId) {
    console.error("User not found for customer:", customerId);
    return;
  }

  const subscriptionId = invoice.subscription
    ? await getSubscriptionId(invoice.subscription)
    : null;

  await prisma.payment.create({
    data: {
      userId,
      subscriptionId,
      stripePaymentId: invoice.payment_intent || invoice.id,
      stripeInvoiceId: invoice.id,
      amount: invoice.amount_due,
      currency: invoice.currency,
      status: "failed",
      description: invoice.description || "Subscription payment",
    },
  });

  console.log(`Payment failed for invoice ${invoice.id}`);
}

/**
 * Handle checkout session completed
 */
async function handleCheckoutSessionCompleted(sessionData: any) {
  const session = sessionData as {
    mode: string;
    subscription: string | null;
    customer: string | null;
  };

  if (session.mode === "subscription") {
    const subscriptionId = session.subscription;
    const customerId = session.customer;

    console.log(
      `Checkout session completed for subscription ${subscriptionId}`,
    );
  }
}

/**
 * Helper: Get user ID from Stripe customer ID
 */
async function getUserIdFromCustomer(
  customerId: string,
): Promise<string | null> {
  const user = await prisma.user.findFirst({
    where: { stripeCustomerId: customerId },
    select: { id: true },
  });

  return user?.id || null;
}

/**
 * Helper: Get internal subscription ID from Stripe subscription ID
 */
async function getSubscriptionId(
  stripeSubscriptionId: string,
): Promise<string | null> {
  const subscription = await prisma.subscription.findUnique({
    where: { stripeSubscriptionId },
    select: { id: true },
  });

  return subscription?.id || null;
}
