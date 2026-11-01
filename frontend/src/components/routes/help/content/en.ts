// Long texts written per language (see types.ts), kept out of the translation catalogs on purpose.
/* eslint-disable lingui/no-unlocalized-strings */
import {HelpContent, HelpGuide} from "./types.ts";

const stripe: HelpGuide = {
    slug: 'configurer-stripe',
    category: 'Payments',
    title: 'Set up Stripe for Billetterie Dehors',
    lead: 'To sell tickets by credit card, connect a Stripe account to your organizer account. It takes about 15 minutes. Stripe pays the money from your sales straight into your bank account.',
    updated: '2026-11-01',
    minutes: 3,
    blocks: [
        {h2: 'Before you start'},
        {p: 'Have these at hand:'},
        {
            ul: [
                'An email address and a mobile phone number',
                'The legal name of your organization or business (or your own name, if you are self-employed)',
                'Your business number (NEQ or CRA number), if you have one',
                'Photo ID of the account representative',
                'The details of the bank account that will receive the money (transit, institution and account numbers)',
            ],
        },
        {h2: 'Step 1: start the connection from Billetterie Dehors'},
        {p: "You don't need to create a Stripe account beforehand: the button in Billetterie Dehors takes care of it."},
        {
            ol: [
                'Sign in to [billets.dehorsqc.com](/auth/login) with your organizer account.',
                'Open **Settings** (left menu), then the [Payments](/account/payment) tab.',
                'In **Stripe account**, click **Connect Stripe**. You are taken to Stripe.',
            ],
        },
        {p: "If you already have a Stripe account, sign in with it. Otherwise, Stripe creates one for you along the way."},
        {h2: 'Step 2: fill in the Stripe form (the minimum)'},
        {p: 'Stripe asks a series of questions. Here is the minimum needed to accept payments:'},
        {
            ul: [
                '**Country**: Canada',
                '**Business type**: individual / self-employed, company or non-profit, depending on your case',
                '**Business details**: legal name, address, business number if you have one',
                '**Website or description**: the address of your Billetterie Dehors page or your social media, plus a sentence like "Ticket sales for our events"',
                '**Account representative**: name, date of birth, address, phone, last 4 digits of your SIN if asked',
                '**Bank account**: transit, institution and account numbers',
                '**Statement descriptor**: the name your buyers will see on their card statement (e.g. the name of your festival)',
            ],
        },
        {p: 'Once Stripe confirms, you are sent back to Billetterie Dehors automatically. If you leave halfway, come back to **Settings → Payments** and click **Finish Stripe Setup**.'},
        {h2: 'Step 3: check that everything works'},
        {
            ul: [
                'In **Settings → Payments**, the **Stripe account** section should read **Connected to Stripe**.',
                'In your event, open **Event Settings → Payment & Invoicing**. Under **Payment Methods**, the **Stripe** switch should be on (it is by default). The change is saved right away.',
                'Make a test purchase with your own card on a low-priced ticket, then refund it from the order.',
            ],
        },
        {tip: 'Payouts reach your bank account on Stripe\'s schedule. The first one can take up to 7 days; after that, usually 2 business days. You can follow everything in your Stripe Express dashboard: [connect.stripe.com/express_login](https://connect.stripe.com/express_login).'},
        {h2: 'Common problems'},
        {
            ul: [
                '**The button still says "Finish Stripe setup"**: Stripe is still waiting for some information. Click it and fill in what is marked in red.',
                "**Buyers don't see card payment**: check that Stripe is on in the event's **Payment & Invoicing**.",
                '**Stripe asks for an identity check**: upload the requested ID in your Stripe dashboard.',
                '**Payouts are paused**: open your Stripe dashboard, an alert shows what is missing.',
            ],
        },
    ],
};

const firstEvent: HelpGuide = {
    slug: 'premier-evenement',
    category: 'Events',
    title: 'Create and publish your first event',
    lead: 'From a blank page to ticket sales: create the event, add your tickets, then put it online. It takes about ten minutes.',
    updated: '2026-11-01',
    minutes: 4,
    blocks: [
        {h2: 'Step 1: create the event'},
        {
            ol: [
                'In your organizer space, click **Create Event** at the top of the page.',
                'Fill in the **Event Name** and the **Start Date & Time**. The category, description and end date are optional: you can add them later.',
                'If you manage several organizers, pick the one presenting the event under **Who is organizing this event?**',
                'Click **Continue Setup**. The **Getting Started** page guides you through the rest.',
            ],
        },
        {h2: 'Step 2: add your tickets'},
        {
            ol: [
                "In the event's menu, under **Ticketing & Sales**, open **Tickets & Products**.",
                'Click **Add a ticket or product**, at the top right (at the top of the page on a phone).',
                'Pick the **Product Type**: **Ticket** for an admission, **General** for a T-shirt, a meal or parking.',
                'Pick the **Price Type**: paid, free, tiered (e.g. student and adult) or with options (e.g. sizes or distances).',
                'Give it a name and a price, then click **Create Product**. Repeat for each ticket.',
            ],
        },
        {tip: 'To sell by credit card, connect Stripe first: [Set up Stripe for Billetterie Dehors](/help/configurer-stripe). Free tickets and **Offline Payments** work without Stripe.'},
        {h2: 'Step 3: put the event online'},
        {p: 'While it is a draft, only your team can see your event. At the top of its page, click **Draft - Click to Publish**, then confirm. The button then reads **Live - Click to Unpublish**.'},
        {p: 'You need a confirmed email address to publish. To appear on the [Events](/events) page, the event must be live and upcoming, and your organizer page live too.'},
        {h2: 'Before you share the link'},
        {
            ul: [
                'Make a test purchase and check the email you get: it holds the tickets as a PDF, each with its QR code.',
                "Read through the event's public page, on a phone too.",
                'Get check-in ready: [Check-in at the door](/help/pointage).',
            ],
        },
    ],
};

const refund: HelpGuide = {
    slug: 'rembourser-annuler',
    category: 'Orders',
    title: 'Refund or cancel an order',
    lead: "An attendee can't make it, or the event changes? You can refund all or part of an order, and cancel it, from the list of orders.",
    updated: '2026-11-01',
    minutes: 3,
    blocks: [
        {h2: 'Refund an order'},
        {
            ol: [
                'Open the event, then **Orders**.',
                "On the order's row, open the **⋮** menu and choose **Refund order**.",
                'In **Refund amount**, keep the full amount or enter a smaller one for a partial refund.',
                "Check **Send refund notification email** to let the buyer know: it isn't checked to begin with.",
                "Check **Also cancel this order** if the person won't come.",
                'Click **Process Refund**.',
            ],
        },
        {tip: "Stripe sends the money back to the buyer's card. It can take 5 to 10 business days to show on their statement."},
        {p: 'Refunds are available for orders paid by card. An offline-payment order is refunded outside the box office (transfer, cash); in that case, simply cancel it.'},
        {h2: 'Cancel an order'},
        {
            ol: [
                "On the order's row, open the **⋮** menu and choose **Cancel order**.",
                'Check **Also refund this order** to refund it in full at the same time.',
                'Confirm.',
            ],
        },
        {p: 'The buyer always gets an email when their order is cancelled.'},
    ],
};

const checkIn: HelpGuide = {
    slug: 'pointage',
    category: 'Event day',
    title: 'Check-in at the door',
    lead: 'Scan tickets at the door with a phone, with no account for your volunteers: a check-in list, a link to share, and you are ready.',
    updated: '2026-11-01',
    minutes: 3,
    blocks: [
        {h2: 'Create a check-in list'},
        {
            ol: [
                'In the event, under **Guest Management**, open **Check-In Lists** (**Check-in** on a phone).',
                'Click **Create Check-In List**. The event needs at least one ticket.',
                'Pick the tickets this list accepts: one list for everything, or one per entrance or per race.',
                'If needed: an **Activation date** and an **Expiration date**, a **Check-in PIN** (4 to 12 digits) to protect the list, or **Allow selling tickets at the door**.',
            ],
        },
        {h2: 'Give your volunteers access'},
        {p: "On the list's card, click **Copy link** and send it to your team. Your volunteers don't need an account: they open the link on their phone, and enter the PIN if you set one. To open it yourself, click the arrow next to it (**Open check-in page**)."},
        {h2: 'At the door'},
        {
            ul: [
                "**Scan**, then **Camera Scanner**: the phone's camera reads the ticket's QR code, on a screen or printed.",
                '**USB/HID Scanner**: for a barcode reader plugged into a computer.',
                'No QR code at hand? Search for the person by name, email, or order or attendee number.',
            ],
        },
        {tip: 'Do a trial run the day before with a test ticket, on the phone you will use at the door.'},
    ],
};

const messages: HelpGuide = {
    slug: 'ecrire-aux-participants',
    category: 'Communication',
    title: 'Write to your attendees',
    lead: 'A schedule change, a gear reminder? Email all your attendees, or only the holders of one ticket, from the event.',
    updated: '2026-11-01',
    minutes: 2,
    blocks: [
        {h2: 'Send a message'},
        {
            ol: [
                'In the event, open **Messages**, then click **Compose**.',
                'Under **Recipients**, choose **All attendees of this event**, **Attendees with a specific ticket** or **Order owners with a specific product**.',
                'Write your message. You can attach a PDF (a site map, a schedule).',
                'To check how it looks, click **Send as test**, or check **Send me a copy**.',
                'Check **I confirm this is a transactional message related to this event**.',
                'Choose **Send now** or **Schedule for later**.',
            ],
        },
        {p: "To write to a single buyer: in **Orders**, open the **⋮** menu of their order and choose **Message buyer**."},
        {tip: "Messaging turns on once your email address is confirmed and Stripe is connected. Before that, you'll see **Connect Stripe to enable messaging**."},
        {p: "Messages are for telling your attendees about the event: they aren't a newsletter tool."},
    ],
};

export const en: HelpContent = {
    guides: [firstEvent, stripe, checkIn, refund, messages],
    questions: [
        {
            category: 'Payments',
            question: 'How much does Billetterie Dehors cost?',
            answer: "2.5% per ticket sold, plus Stripe's payment fees (2.9% + $0.30). No subscription, no hidden fees, and nothing at all if your event is free.\n\nWould you rather the buyer pays them? Choose **Pass on to the buyer** in **Settings → Payments** (**Ticketing fees** section): your new events start that way. For an event already created, open **Event Settings → Payment & Invoicing**: the **Ticketing fees** section offers the same choice, for that event only.",
        },
        {
            category: 'Payments',
            question: 'Do I need Stripe?',
            answer: 'To sell tickets by credit card, yes: see [Set up Stripe for Billetterie Dehors](/help/configurer-stripe). To publish an event, offer free tickets or accept **Offline Payments** (transfer, cash), no.',
        },
        {
            category: 'Payments',
            question: 'When do I get my money?',
            answer: 'Stripe pays your sales straight into your bank account. The first payout can take up to 7 days; after that, usually 2 business days.',
        },
        {
            category: 'Events',
            question: "Why doesn't my event show on the Events page?",
            answer: "The [Events](/events) page shows live, upcoming events. Check that your event is published (**Live - Click to Unpublish** at the top of its page) and that your organizer page is live too.",
        },
        {
            category: 'Events',
            question: 'Can I ask attendees questions (T-shirt size, emergency contact)?',
            answer: "Yes: in the event, open **Registration Questions** and click **Add Question**. The answers show in each attendee's details and in the exports.",
        },
        {
            category: 'Events',
            question: 'Can I create promo codes?',
            answer: 'Yes: in the event, open **Promo Codes** and click **Create Promo Code**. A code can give a discount as a percentage or in dollars, on some tickets only.',
        },
        {
            category: 'Orders',
            question: 'Do my buyers need an account?',
            answer: "No. After buying, they get an email with their tickets as a PDF (one QR code per ticket) and the event to add to their calendar. They can find their tickets anytime in [My tickets](/my-tickets), with the email they used to buy.",
        },
        {
            category: 'Orders',
            question: 'How do I refund an attendee?',
            answer: "In **Orders**, the order's **⋮** menu, **Refund order**. The refund can be full or partial. It's all in [Refund or cancel an order](/help/rembourser-annuler).",
        },
        {
            category: 'Event day',
            question: 'How do I scan tickets at the door?',
            answer: "With a check-in list and a phone: your volunteers open a link, with no account, and scan the QR codes with the camera. See [Check-in at the door](/help/pointage).",
        },
        {
            category: 'Account',
            question: 'Can several people manage the box office?',
            answer: 'Yes. Open **Settings → Team** (or **Team** in your profile menu) and click **Invite User**. An **Admin** has access to everything; an **Organizer** manages events and tickets.',
        },
        {
            category: 'Account',
            question: 'What can the assistant do?',
            answer: "It knows the box office and reads your account: sales, orders, attendees, settings. It can also make changes for you (a price, a promo code, a ticket), but nothing changes until you approve it. Ask it your question at the top of this page.",
        },
    ],
};
