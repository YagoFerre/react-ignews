import { NextApiRequest, NextApiResponse } from 'next';
import { Readable } from 'stream';
import Stripe from 'stripe';
import { stripe } from '../../services/stripe';
import { saveSubscription } from './_lib/menageSubscription';


async function buffer(readable: Readable) {
    const chunks = [];

    for await (const chunk of readable) {
      chunks.push(
        typeof chunk === "string" ? Buffer.from(chunk) : chunk
    );
  }

  return Buffer.concat(chunks);
}

export const config = {
    api: {
        bodyParser: false
    }
}

const relevantEvents = new Set([
    "checkout.session.completed",
    "customer.subscription.updated",
    "customer.subscription.deleted",
])

// eslint-disable-next-line import/no-anonymous-default-export
export default async (req: NextApiRequest, res: NextApiResponse) => {
    if (req.method === "POST") {
        const buf = await buffer(req)
        const secret = req.headers["stripe-signature"] as string

        let event: Stripe.Event;

        try {
            event = stripe.webhooks.constructEvent(buf, secret, String(process.env.STRIPE_WEBHOOK_SECRET));
        } catch (err: any) {
            return res.status(400).send(`Webhook Error: ${err.message}`)
        }

        const { type } = event;

        if (relevantEvents.has(type)) {
            try {
                switch (type) {
                    case "customer.subscription.updated":
                    case "customer.subscription.deleted":
                        const subscription = event.data.object as Stripe.Subscription;
                        await saveSubscription(
                            subscription.id,
                            subscription.customer.toString(),
                            false
                        )
                        break;
                    case "checkout.session.completed":
                        const checkoutSession = event.data.object as Stripe.Checkout.Session;
                        await saveSubscription(
                            String(checkoutSession.subscription),
                            String(checkoutSession.customer),
                            true
                        )
                        break;
                    default:
                        throw new Error("Unhandled event.")
                }
            } catch(err) {
                console.log(err)
                return res.json({ error: "Webhook handler failed"})
              }
        }

        res.json({ recived: true })
    } else {
        res.setHeader("Allow", "POST");
        res.status(405).end("Method not allowed");
    }
}