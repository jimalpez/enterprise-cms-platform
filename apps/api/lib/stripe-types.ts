// lib/stripe-types.ts

import Stripe from "stripe";

// Re-export Stripe types with clear names
export type StripeSubscription = Stripe.Subscription;
export type StripeInvoice = Stripe.Invoice;
export type StripeCheckoutSession = Stripe.Checkout.Session;
export type StripeEvent = Stripe.Event;
