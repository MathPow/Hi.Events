import { lazy, Suspense, useEffect, useState } from "react";
import { matchRoutes, Navigate, Outlet, redirect, RouteObject, useLocation } from "react-router";
import { setKnownRouteMatcher } from "./api/client.ts";
import ErrorPage from "./error-page.tsx";
import { useGetMe } from "./queries/useGetMe.ts";
import { publicEventRouteLoader } from "./routeLoaders/publicEventRouteLoader.ts";
import { publicOrganizerRouteLoader } from "./routeLoaders/publicOrganizerRouteLoader.ts";
import { organizerPreviewRouteLoader } from "./routeLoaders/organizerPreviewRouteLoader.ts";
import { landingRouteLoader } from "./routeLoaders/landingRouteLoader.ts";
import { eventsDirectoryRouteLoader } from "./routeLoaders/eventsDirectoryRouteLoader.ts";
import { myTicketsRouteLoader } from "./routeLoaders/myTicketsRouteLoader.ts";
import Landing from "./components/routes/landing";

const GettingStartedRedirect = () => {
    const {search} = useLocation();
    return <Navigate to={{pathname: "../dashboard", search}} replace />;
};

const Root = () => {
    const me = useGetMe();
    const searchParams = typeof window !== 'undefined' ? window.location.search : '';

    if (me.isSuccess) {
        return <Navigate to={"/manage/events" + searchParams} replace={true} />;
    }

    if (me.isFetched && searchParams) {
        return <Navigate to={"/auth/login" + searchParams} replace={true} />;
    }

    return <Landing />;
};

const routes: RouteObject[] = [
    {
        path: "",
        element: <Root />,
        loader: landingRouteLoader,
        errorElement: <ErrorPage />
    },
    {
        path: "auth",
        async lazy() {
            const AuthLayout = await import("./components/layouts/AuthLayout");
            return { Component: AuthLayout.default };
        },
        errorElement: <ErrorPage />,
        children: [
            {
                path: "login",
                async lazy() {
                    const Login = await import("./components/routes/auth/Login");
                    return { Component: Login.default };
                },
            },
            {
                path: "register",
                async lazy() {
                    const Register = await import("./components/routes/auth/Register");
                    return { Component: Register.default };
                }
            },
            {
                path: "forgot-password",
                async lazy() {
                    const ForgotPassword = await import("./components/routes/auth/ForgotPassword");
                    return { Component: ForgotPassword.default };
                }
            },
            {
                path: "reset-password/:token",
                async lazy() {
                    const ResetPassword = await import("./components/routes/auth/ResetPassword");
                    return { Component: ResetPassword.default };
                }
            },
            {
                path: "accept-invitation/:token",
                async lazy() {
                    const AcceptInvitation = await import("./components/routes/auth/AcceptInvitation");
                    return { Component: AcceptInvitation.default };
                }
            }
        ]
    },
    {
        // The pages without an organizer in their address open in the organizer's space
        // (account/OrganizerRedirect): the dashboard, the profile, the email confirmations.
        path: "manage",
        errorElement: <ErrorPage />,
        element: <Outlet />,
        children: [
            {
                path: "events/:eventsState?",
                async lazy() {
                    const {DashboardRedirect} = await import("./components/routes/account/OrganizerRedirect");
                    return { Component: DashboardRedirect };
                },
            },
            {
                // Les parametres du compte sont des onglets de « Parametres » de l'organisateur.
                path: "account/:section?",
                async lazy() {
                    const AccountSettingsRedirect = await import("./components/routes/account/AccountSettingsRedirect");
                    return { Component: AccountSettingsRedirect.default };
                }
            },
            {
                path: "profile",
                async lazy() {
                    const {ProfileRedirect} = await import("./components/routes/account/OrganizerRedirect");
                    return { Component: ProfileRedirect };
                }
            },
            {
                path: "profile/confirm-email-change/:token",
                async lazy() {
                    const {ConfirmEmailChangeRedirect} = await import("./components/routes/account/OrganizerRedirect");
                    return { Component: ConfirmEmailChangeRedirect };
                }
            },
            {
                path: "profile/confirm-email-address/:token",
                async lazy() {
                    const {ConfirmEmailAddressRedirect} = await import("./components/routes/account/OrganizerRedirect");
                    return { Component: ConfirmEmailAddressRedirect };
                }
            },
        ]
    },
    {
        path: "welcome",
        async lazy() {
            const WelcomeLayout = await import("./components/layouts/WelcomeLayout");
            return { Component: WelcomeLayout.default };
        },
        errorElement: <ErrorPage />,
        children: [
            {
                path: "",
                async lazy() {
                    const Welcome = await import("./components/routes/welcome");
                    return { Component: Welcome.default };
                }
            },
        ]
    },
    {
        path: "admin",
        errorElement: <ErrorPage />,
        async lazy() {
            const AdminLayout = await import("./components/layouts/Admin");
            return { Component: AdminLayout.default };
        },
        children: [
            {
                path: "",
                async lazy() {
                    const Dashboard = await import("./components/routes/admin/Dashboard");
                    return { Component: Dashboard.default };
                }
            },
            {
                path: "accounts",
                async lazy() {
                    const Accounts = await import("./components/routes/admin/Accounts");
                    return { Component: Accounts.default };
                }
            },
            {
                path: "accounts/:accountId",
                async lazy() {
                    const AccountDetail = await import("./components/routes/admin/Accounts/AccountDetail");
                    return { Component: AccountDetail.default };
                }
            },
            {
                path: "users",
                async lazy() {
                    const Users = await import("./components/routes/admin/Users");
                    return { Component: Users.default };
                }
            },
            {
                path: "registration-invites",
                async lazy() {
                    const RegistrationInvites = await import("./components/routes/admin/RegistrationInvites");
                    return { Component: RegistrationInvites.default };
                }
            },
            {
                path: "events",
                async lazy() {
                    const Events = await import("./components/routes/admin/Events");
                    return { Component: Events.default };
                }
            },
            {
                path: "orders",
                async lazy() {
                    const Orders = await import("./components/routes/admin/Orders");
                    return { Component: Orders.default };
                }
            },
            {
                path: "platform-revenue",
                async lazy() {
                    const PlatformRevenue = await import("./components/routes/admin/PlatformRevenue");
                    return { Component: PlatformRevenue.default };
                }
            },
            {
                path: "assistant",
                async lazy() {
                    const AssistantUsage = await import("./components/routes/admin/AssistantUsage");
                    return { Component: AssistantUsage.default };
                }
            },
            {
                path: "attribution",
                async lazy() {
                    const Attribution = await import("./components/routes/admin/Attribution");
                    return { Component: Attribution.default };
                }
            },
            {
                path: "configurations",
                async lazy() {
                    const Configurations = await import("./components/routes/admin/Configurations");
                    return { Component: Configurations.default };
                }
            },
            {
                path: "failed-jobs",
                async lazy() {
                    const FailedJobs = await import("./components/routes/admin/FailedJobs");
                    return { Component: FailedJobs.default };
                }
            },
            {
                path: "messages",
                async lazy() {
                    const Messages = await import("./components/routes/admin/Messages");
                    return { Component: Messages.default };
                }
            }
        ]
    },
    {
        // Les anciens « Parametres du compte » (/account/payment...) menent aux onglets de « Parametres ».
        path: "account/:section?",
        errorElement: <ErrorPage />,
        async lazy() {
            const AccountSettingsRedirect = await import("./components/routes/account/AccountSettingsRedirect");
            return { Component: AccountSettingsRedirect.default };
        },
    },
    {
        path: "/manage/organizer/:organizerId?",
        async lazy() {
            const Dashboard = await import("./components/layouts/OrganizerLayout");
            return { Component: Dashboard.default };
        },
        errorElement: <ErrorPage />,
        children: [
            {
                path: "dashboard?",
                async lazy() {
                    const OrganizerDashboard = await import("./components/routes/organizer/OrganizerDashboard");
                    return { Component: OrganizerDashboard.default };
                }
            },
            {
                path: "profile",
                async lazy() {
                    const ManageProfile = await import("./components/routes/profile/ManageProfile");
                    return { Component: ManageProfile.default };
                }
            },
            {
                path: "orders",
                async lazy() {
                    const Orders = await import("./components/routes/organizer/Orders");
                    return { Component: Orders.default };
                }
            },
            {
                path: "achievements",
                async lazy() {
                    const Achievements = await import("./components/routes/organizer/Achievements");
                    return { Component: Achievements.default };
                }
            },
            {
                path: "messages",
                async lazy() {
                    const Messages = await import("./components/routes/organizer/Messages");
                    return { Component: Messages.default };
                }
            },
            {
                path: "documents",
                async lazy() {
                    const Documents = await import("./components/routes/organizer/Documents");
                    return { Component: Documents.default };
                }
            },
            {
                path: "documents/:documentId",
                async lazy() {
                    const DocumentEditor = await import("./components/routes/organizer/Documents/DocumentEditor");
                    return { Component: DocumentEditor.default };
                }
            },
            {
                path: "emails",
                async lazy() {
                    const Emails = await import("./components/routes/organizer/Emails");
                    return { Component: Emails.default };
                }
            },
            {
                path: "events/:eventsState?",
                async lazy() {
                    const Events = await import("./components/routes/organizer/Events");
                    return { Component: Events.default };
                }
            },
            {
                path: "settings/:tab?",
                async lazy() {
                    const Settings = await import("./components/routes/organizer/Settings");
                    return { Component: Settings.default };
                }
            },
            {
                path: "organizer-homepage-designer",
                async lazy() {
                    const OrganizerHomepageDesigner = await import("./components/routes/organizer/OrganizerHomepageDesigner");
                    return { Component: OrganizerHomepageDesigner.default };
                }
            },
            {
                // The FAQ is now edited in « Ma page », where it shows.
                path: "faq",
                element: <Navigate to="../organizer-homepage-designer?section=faq" replace={true} />,
            },
            {
                path: "webhooks",
                async lazy() {
                    const Webhooks = await import("./components/routes/organizer/Webhooks");
                    return { Component: Webhooks.default };
                }
            },
            {
                path: "reports",
                async lazy() {
                    const OrganizerReports = await import("./components/routes/organizer/Reports");
                    return { Component: OrganizerReports.default };
                }
            },
            {
                path: "report/:reportType",
                async lazy() {
                    // Les rapports s'ouvrent maintenant sur place dans Rapports.
                    const OrganizerReports = await import("./components/routes/organizer/Reports");
                    return { Component: OrganizerReports.ReportRedirect };
                }
            }
        ],
    },
    {
        path: "/manage/event/:eventId",
        async lazy() {
            const EventLayout = await import("./components/layouts/Event");
            return { Component: EventLayout.default };
        },
        errorElement: <ErrorPage />,
        children: [
            {
                path: "",
                async lazy() {
                    const EventDashboard = await import("./components/routes/event/EventDashboard");
                    return { Component: EventDashboard.default };
                }
            },
            {
                path: "dashboard",
                async lazy() {
                    const EventDashboard = await import("./components/routes/event/EventDashboard");
                    return { Component: EventDashboard.default };
                }
            },
            {
                path: "reports",
                async lazy() {
                    const Reports = await import("./components/routes/event/Reports");
                    return { Component: Reports.default };
                },
            },
            {
                path: "report/:reportType",
                async lazy() {
                    const ReportLayout = await import("./components/routes/event/Reports/ReportLayout");
                    return { Component: ReportLayout.default };
                },
            },
            {
                path: "products",
                async lazy() {
                    const Products = await import("./components/routes/event/products");
                    return { Component: Products.default };
                }
            },
            {
                // « Commandes et participants »: one page, its capsule on /orders and /attendees.
                path: "attendees",
                async lazy() {
                    const OrdersAndAttendees = await import("./components/routes/event/OrdersAndAttendees");
                    return { Component: OrdersAndAttendees.default };
                }
            },
            {
                path: "questions",
                async lazy() {
                    const Questions = await import("./components/routes/event/questions");
                    return { Component: Questions.default };
                }
            },
            {
                path: "orders",
                async lazy() {
                    const OrdersAndAttendees = await import("./components/routes/event/OrdersAndAttendees");
                    return { Component: OrdersAndAttendees.default };
                }
            },
            {
                path: "promo-codes",
                async lazy() {
                    const PromoCodes = await import("./components/routes/event/promo-codes");
                    return { Component: PromoCodes.default };
                }
            },
            {
                path: "deposits",
                async lazy() {
                    const Deposits = await import("./components/routes/event/Deposits");
                    return { Component: Deposits.default };
                }
            },
            {
                path: "affiliates",
                async lazy() {
                    const Affiliates = await import("./components/routes/event/Affiliates");
                    return { Component: Affiliates.default };
                }
            },
            {
                path: "check-in",
                async lazy() {
                    const CheckIn = await import("./components/routes/event/CheckInLists");
                    return { Component: CheckIn.default };
                }
            },
            {
                path: "messages",
                async lazy() {
                    const Messages = await import("./components/routes/event/messages");
                    return { Component: Messages.default };
                }
            },
            {
                path: "settings/:tab?",
                async lazy() {
                    const Settings = await import("./components/routes/event/Settings");
                    return { Component: Settings.default };
                }
            },
            {
                path: "widget",
                async lazy() {
                    const Widget = await import("./components/routes/event/widget");
                    return { Component: Widget.default };
                }
            },
            {
                path: "homepage-designer",
                async lazy() {
                    const HomepageDesigner = await import("./components/routes/event/HomepageDesigner");
                    return { Component: HomepageDesigner.default };
                }
            },
            {
                // « Commencer » is now the card at the top of the dashboard (old links and ?new_event).
                path: "getting-started",
                Component: GettingStartedRedirect,
            },
            {
                path: "sold-out-waitlist",
                async lazy() {
                    const SoldOutWaitlist = await import("./components/routes/event/SoldOutWaitlist");
                    return { Component: SoldOutWaitlist.default };
                }
            },
            {
                path: "capacity-assignments",
                async lazy() {
                    const CapacityAssignments = await import("./components/routes/event/CapacityAssignments");
                    return { Component: CapacityAssignments.default };
                }
            },
            {
                path: "webhooks",
                async lazy() {
                    const Webhooks = await import("./components/routes/event/Webhooks");
                    return { Component: Webhooks.default };
                }
            }
        ]
    },
    {
        path: "/events",
        loader: eventsDirectoryRouteLoader,
        async lazy() {
            const EventsDirectory = await import("./components/routes/events-directory");
            return { Component: EventsDirectory.default };
        },
        errorElement: <ErrorPage />,
    },
    {
        path: "/help",
        async lazy() {
            const HelpCenter = await import("./components/routes/help");
            return { Component: HelpCenter.default };
        },
        errorElement: <ErrorPage />,
    },
    {
        path: "/help/:slug",
        async lazy() {
            const HelpGuide = await import("./components/routes/help/HelpGuide");
            return { Component: HelpGuide.default };
        },
        errorElement: <ErrorPage />,
    },
    {
        path: "/events/:organizerId/:organizerSlug",
        loader: publicOrganizerRouteLoader,
        async lazy() {
            const PublicOrganizer = await import("./components/layouts/PublicOrganizer");
            return { Component: PublicOrganizer.default };
        },
        errorElement: <ErrorPage />,
    },
    {
        path: "/events/:organizerId/:organizerSlug/past-events",
        loader: publicOrganizerRouteLoader,
        async lazy() {
            const PublicOrganizer = await import("./components/layouts/PublicOrganizer");
            return { Component: PublicOrganizer.default };
        },
        errorElement: <ErrorPage />,
    },
    {
        // Ancien lien court: la page publique de l'evenement est sous /event/.
        path: "/e/:eventId/:eventSlug",
        loader: ({params}) => redirect(`/event/${params.eventId}/${params.eventSlug}`),
        errorElement: <ErrorPage />,
    },
    {
        path: "/event/:eventId/preview",
        async lazy() {
            const EventHomepagePreview = await import("./components/layouts/EventHomepagePreview");
            return { Component: EventHomepagePreview.default };
        },
    },
    {
        path: "/organizer/:organizerId/preview",
        loader: organizerPreviewRouteLoader,
        async lazy() {
            const OrganizerHomepagePreview = await import("./components/layouts/OrganizerHomepagePreview");
            return { Component: OrganizerHomepagePreview.default };
        },
    },
    {
        path: "/event/:eventId/:eventSlug",
        loader: publicEventRouteLoader,
        async lazy() {
            const PublicEvent = await import("./components/layouts/PublicEvent");
            return { Component: PublicEvent.default };
        },
        errorElement: <ErrorPage />,
    },
    {
        path: "/widget/:eventId",
        async lazy() {
            const ProductWidget = await import("./components/layouts/ProductWidget");
            return { Component: ProductWidget.default };
        },
        errorElement: <ErrorPage />,
    },
    {
        path: "/checkout/:eventId",
        async lazy() {
            const Checkout = await import("./components/layouts/Checkout");
            return { Component: Checkout.default };
        },
        errorElement: <ErrorPage />,
        children: [
            {
                path: ":orderShortId/details",
                async lazy() {
                    const CollectInformation = await import("./components/routes/product-widget/CollectInformation");
                    return { Component: CollectInformation.default };
                }
            },
            {
                path: ":orderShortId/payment",
                async lazy() {
                    const Payment = await import("./components/routes/product-widget/Payment");
                    return { Component: Payment.default };
                }
            },
            {
                path: ":orderShortId/summary",
                async lazy() {
                    const OrderSummaryAndProducts = await import("./components/routes/product-widget/OrderSummaryAndProducts");
                    return { Component: OrderSummaryAndProducts.default };
                }
            },
            {
                path: ":orderShortId/payment_return",
                async lazy() {
                    const PaymentReturn = await import("./components/routes/product-widget/PaymentReturn");
                    return { Component: PaymentReturn.default };
                }
            },
        ]
    },
    {
        path: "/order/:eventId/:orderShortId/print",
        async lazy() {
            const PrintOrder = await import("./components/routes/product-widget/PrintOrder");
            return { Component: PrintOrder.default };
        },
        errorElement: <ErrorPage />
    },
    {
        path: "/product/:eventId/:attendeeShortId/print",
        async lazy() {
            const PrintProduct = await import("./components/routes/product-widget/PrintProduct");
            return { Component: PrintProduct.default };
        },
        errorElement: <ErrorPage />
    },
    {
        path: "/product/:eventId/:attendeeShortId",
        async lazy() {
            const AttendeeProductAndInformation = await import("./components/routes/product-widget/AttendeeProductAndInformation");
            return { Component: AttendeeProductAndInformation.default };
        },
        errorElement: <ErrorPage />
    },
    {
        path: "/check-in/:checkInListShortId",
        async lazy() {
            const CheckIn = await import("./components/layouts/CheckIn");
            return { Component: CheckIn.default };
        },
        errorElement: <ErrorPage />,
    },
    {
        path: "/partner/:token",
        async lazy() {
            const AffiliatePartnerPage = await import("./components/routes/partner");
            return { Component: AffiliatePartnerPage.default };
        },
        errorElement: <ErrorPage />,
    },
    {
        path: "/my-tickets/:token?",
        loader: myTicketsRouteLoader,
        async lazy() {
            const MyTickets = await import("./components/routes/my-tickets");
            return { Component: MyTickets.default };
        },
        errorElement: <ErrorPage />,
    }
];

const Assistant = lazy(() => import("./components/common/Assistant"));

// Not the help center: it has its own question box, answered right under it (help/AskAssistant).
const BACK_OFFICE = /^\/(manage|account|admin|welcome)(\/|$)/;

// Every page shares this root so the organizer assistant stays mounted, and keeps its
// answer running, when a page moves from one back-office layout to another. It loads
// in the browser only, on back-office pages.
const Shell = () => {
    const { pathname } = useLocation();
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);

    return (
        <>
            <Outlet />
            {mounted && BACK_OFFICE.test(pathname) && (
                <Suspense fallback={null}>
                    <Assistant />
                </Suspense>
            )}
        </>
    );
};

export const router: RouteObject[] = [
    {
        element: <Shell />,
        // An address no route matches lands here: without it, React Router showed its own error screen.
        errorElement: <ErrorPage />,
        children: routes,
    },
];

setKnownRouteMatcher((path) => matchRoutes(router, path) !== null);
