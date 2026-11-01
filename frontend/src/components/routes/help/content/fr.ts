// Long texts written per language (see types.ts), kept out of the translation catalogs on purpose.
/* eslint-disable lingui/no-unlocalized-strings */
import {HelpContent, HelpGuide} from "./types.ts";

const stripe: HelpGuide = {
    slug: 'configurer-stripe',
    category: 'Paiements',
    title: 'Configurer Stripe pour Billetterie Dehors',
    lead: "Pour vendre des billets par carte de crédit, il suffit de connecter un compte Stripe à votre compte organisateur. Comptez environ 15 minutes. L'argent des ventes est versé directement dans votre compte bancaire par Stripe.",
    updated: '2026-11-01',
    minutes: 3,
    blocks: [
        {h2: 'Avant de commencer'},
        {p: 'Ayez ces éléments sous la main :'},
        {
            ul: [
                'Une adresse courriel et un numéro de téléphone mobile',
                "Le nom légal de votre organisme ou entreprise (ou votre nom, si vous êtes travailleur autonome)",
                "Votre numéro d'entreprise (NEQ ou numéro de l'ARC), si vous en avez un",
                "Une pièce d'identité avec photo du responsable du compte",
                "Les coordonnées du compte bancaire où recevoir l'argent (transit, institution, numéro de compte)",
            ],
        },
        {h2: 'Étape 1 : lancer la connexion depuis Billetterie Dehors'},
        {p: "Vous n'avez pas besoin de créer un compte Stripe à l'avance : le bouton dans Billetterie Dehors s'en occupe."},
        {
            ol: [
                'Connectez-vous à [billets.dehorsqc.com](/auth/login) avec votre compte organisateur.',
                'Ouvrez **Paramètres du compte** (menu de votre profil).',
                "Allez dans l'onglet [Paiement et abonnement](/account/payment).",
                'Cliquez sur **Connectez-vous avec Stripe**. Vous êtes redirigé vers Stripe.',
            ],
        },
        {p: 'Si vous avez déjà un compte Stripe, connectez-vous avec. Sinon, Stripe en crée un pour vous dans la même démarche.'},
        {h2: 'Étape 2 : remplir le formulaire Stripe (le minimum)'},
        {p: 'Stripe pose une série de questions. Voici le minimum à remplir pour pouvoir encaisser :'},
        {
            ul: [
                '**Pays** : Canada',
                "**Type d'entreprise** : particulier / travailleur autonome, entreprise ou organisme sans but lucratif, selon votre cas",
                "**Infos sur l'entreprise** : nom légal, adresse, numéro d'entreprise si vous en avez un",
                '**Site web ou description** : l\'adresse de votre page sur Billetterie Dehors ou vos réseaux sociaux, plus une phrase comme « Vente de billets pour nos événements »',
                '**Responsable du compte** : nom, date de naissance, adresse, téléphone, 4 derniers chiffres du NAS si demandé',
                "**Compte bancaire** : numéros de transit, d'institution et de compte",
                '**Libellé de relevé** : le nom que vos clients verront sur leur relevé de carte (ex. le nom de votre festival)',
            ],
        },
        {p: 'Quand Stripe confirme, vous revenez automatiquement sur Billetterie Dehors. Si vous quittez en cours de route, revenez dans **Paiement et abonnement** et cliquez sur **Terminer la configuration Stripe**.'},
        {h2: 'Étape 3 : vérifier que tout fonctionne'},
        {
            ul: [
                'Dans **Paramètres du compte → Paiement et abonnement**, le statut doit afficher **Connecté à Stripe**.',
                "Dans votre événement, ouvrez **Paramètres de l'événement → Paiement et facturation**. Sous **Méthodes de paiement**, la case **Stripe** doit être cochée (elle l'est par défaut). Cliquez sur **Sauvegarder** si vous l'avez modifiée.",
                'Faites un achat test avec votre propre carte sur un billet à petit prix, puis remboursez-le depuis la commande.',
            ],
        },
        {tip: "Les versements arrivent dans votre compte bancaire selon le calendrier de Stripe. Le premier peut prendre jusqu'à 7 jours ; ensuite, c'est en général 2 jours ouvrables. Vous suivez tout dans votre tableau de bord Stripe Express : [connect.stripe.com/express_login](https://connect.stripe.com/express_login)."},
        {h2: 'Problèmes fréquents'},
        {
            ul: [
                "**Le bouton affiche toujours « Terminer la configuration Stripe »** : Stripe attend encore une info. Cliquez dessus et complétez ce qui est marqué en rouge.",
                "**Le paiement par carte n'apparaît pas aux acheteurs** : vérifiez que Stripe est coché dans **Paiement et facturation** de l'événement.",
                "**Stripe demande une vérification d'identité** : téléversez la pièce d'identité demandée dans le tableau de bord Stripe.",
                '**Les versements sont en pause** : ouvrez le tableau de bord Stripe, une alerte indique l\'info manquante.',
            ],
        },
    ],
};

const premierEvenement: HelpGuide = {
    slug: 'premier-evenement',
    category: 'Événements',
    title: 'Créer et publier votre premier événement',
    lead: "De la page blanche à la vente : créer l'événement, ajouter vos billets, puis le mettre en ligne. Comptez une dizaine de minutes.",
    updated: '2026-11-01',
    minutes: 4,
    blocks: [
        {h2: "Étape 1 : créer l'événement"},
        {
            ol: [
                'Dans votre espace organisateur, cliquez sur **Créer un événement**, en haut de la page.',
                "Remplissez le **Nom de l'événement** et la **Date et heure de début**. La catégorie, la description et la date de fin sont facultatives : vous pourrez les ajouter plus tard.",
                'Si vous gérez plusieurs organisateurs, choisissez lequel présente l\'événement sous **Qui organise cet événement ?**',
                'Cliquez sur **Continuer la configuration**. La page **Commencer** vous guide pour la suite.',
            ],
        },
        {h2: 'Étape 2 : ajouter vos billets'},
        {
            ol: [
                "Dans le menu de l'événement, sous **Billetterie et ventes**, ouvrez **Billets et produits**.",
                'Cliquez sur **Créer**, puis sur **Billet ou produit**.',
                'Choisissez le **Type de produit** : **Billet** pour une entrée, **Général** pour un chandail, un repas ou un stationnement.',
                'Choisissez le **Type de prix** : payant, gratuit, par paliers (ex. étudiant et adulte) ou avec options (ex. tailles ou distances).',
                'Donnez-lui un nom et un prix, puis cliquez sur **Créer un produit**. Recommencez pour chaque billet.',
            ],
        },
        {tip: "Pour vendre par carte de crédit, connectez d'abord Stripe : [Configurer Stripe pour Billetterie Dehors](/help/configurer-stripe). Les billets gratuits et les **Paiements hors ligne** fonctionnent sans Stripe."},
        {h2: "Étape 3 : mettre l'événement en ligne"},
        {p: "Tant qu'il est en brouillon, votre événement n'est visible que par votre équipe. En haut de sa page, cliquez sur **Brouillon - Cliquez pour publier**, puis confirmez. Le bouton affiche alors **En ligne - Cliquez pour dépublier**."},
        {p: "Il faut avoir confirmé votre adresse courriel pour publier. Pour paraître sur la page [Événements](/events), l'événement doit être en ligne et à venir, et la page de votre organisateur aussi en ligne."},
        {h2: 'Avant de partager le lien'},
        {
            ul: [
                'Faites un achat test et vérifiez le courriel reçu : il contient les billets en PDF, avec leur code QR.',
                "Relisez la page publique de l'événement, sur téléphone aussi.",
                'Préparez le pointage à l\'entrée : [Le pointage à l\'entrée](/help/pointage).',
            ],
        },
    ],
};

const rembourser: HelpGuide = {
    slug: 'rembourser-annuler',
    category: 'Commandes',
    title: 'Rembourser ou annuler une commande',
    lead: "Un participant ne peut plus venir, ou l'événement change ? Vous pouvez rembourser tout ou une partie d'une commande, et l'annuler, depuis la liste des commandes.",
    updated: '2026-11-01',
    minutes: 3,
    blocks: [
        {h2: 'Rembourser une commande'},
        {
            ol: [
                "Ouvrez l'événement, puis **Commandes**.",
                'Sur la ligne de la commande, ouvrez le menu **⋮** et choisissez **Rembourser la commande**.',
                'Dans **Montant du remboursement**, gardez le montant complet ou entrez un montant plus petit pour un remboursement partiel.',
                "Cochez **Envoyer l'e-mail de notification de remboursement** pour prévenir l'acheteur : la case n'est pas cochée au départ.",
                'Cochez **Annuler également cette commande** si la personne ne viendra pas.',
                'Cliquez sur **Traiter le remboursement**.',
            ],
        },
        {tip: "Stripe renvoie l'argent sur la carte de l'acheteur. Il peut mettre de 5 à 10 jours ouvrables à paraître sur son relevé."},
        {p: "Le remboursement est offert pour les commandes payées par carte. Une commande en paiement hors ligne se rembourse en dehors de la billetterie (virement, argent comptant) ; dans ce cas, annulez-la simplement."},
        {h2: 'Annuler une commande'},
        {
            ol: [
                'Sur la ligne de la commande, ouvrez le menu **⋮** et choisissez **Annuler la commande**.',
                'Cochez **Rembourser également cette commande** pour la rembourser au complet du même coup.',
                'Confirmez.',
            ],
        },
        {p: "L'acheteur reçoit toujours un courriel quand sa commande est annulée."},
    ],
};

const pointage: HelpGuide = {
    slug: 'pointage',
    category: 'Jour J',
    title: "Le pointage à l'entrée",
    lead: "Scannez les billets à la porte avec un téléphone, sans compte pour vos bénévoles : une liste de pointage, un lien à partager, et c'est parti.",
    updated: '2026-11-01',
    minutes: 3,
    blocks: [
        {h2: 'Créer une liste de pointage'},
        {
            ol: [
                "Dans l'événement, sous **Gestion des invités**, ouvrez **Listes de pointage** (**Pointage** sur téléphone).",
                "Cliquez sur **Créer une liste de pointage**. L'événement doit avoir au moins un billet.",
                'Choisissez les billets acceptés sur cette liste : une seule liste pour tout, ou une par entrée ou par épreuve.',
                "Au besoin : une **Date d'activation** et une **Date d'expiration**, un **NIP de pointage** (4 à 12 chiffres) pour protéger la liste, ou **Autoriser la vente de billets sur place**.",
            ],
        },
        {h2: 'Donner l\'accès à vos bénévoles'},
        {p: "Cliquez sur **Copier l'URL de pointage** et envoyez le lien à votre équipe. Vos bénévoles n'ont pas besoin de compte : ils ouvrent le lien sur leur téléphone, et entrent le NIP si vous en avez mis un. Pour l'ouvrir vous-même, cliquez sur **Ouvrir la Page d'Enregistrement**."},
        {h2: 'À la porte'},
        {
            ul: [
                '**Scanner**, puis **Scanner caméra** : la caméra du téléphone lit le code QR du billet, à l\'écran ou imprimé.',
                '**Scanner USB/HID** : pour un lecteur de codes branché à un ordinateur.',
                "Pas de code QR sous la main ? Cherchez la personne par son nom, son courriel, ou son numéro de commande ou de participant.",
            ],
        },
        {tip: 'Faites un essai la veille avec un billet de test, sur le téléphone qui servira à la porte.'},
    ],
};

const messages: HelpGuide = {
    slug: 'ecrire-aux-participants',
    category: 'Communication',
    title: 'Écrire à vos participants',
    lead: "Un changement d'horaire, un rappel de matériel ? Envoyez un courriel à tous vos participants, ou seulement aux détenteurs d'un billet, depuis l'événement.",
    updated: '2026-11-01',
    minutes: 2,
    blocks: [
        {h2: 'Envoyer un message'},
        {
            ol: [
                "Dans l'événement, ouvrez **Messages**, puis cliquez sur **Rédiger**.",
                "Sous **Destinataires**, choisissez **Tous les participants à cet événement**, **Participants avec un ticket spécifique** ou **Propriétaires de commandes avec un produit spécifique**.",
                'Écrivez votre message. Vous pouvez joindre un PDF (un plan du site, un horaire).',
                'Pour vérifier le rendu, cliquez sur **Envoyer en test**, ou cochez **M\'envoyer une copie**.',
                "Cochez **Je confirme qu'il s'agit d'un message transactionnel lié à cet événement**.",
                'Choisissez **Envoyer maintenant** ou **Programmer pour plus tard**.',
            ],
        },
        {p: "Pour écrire à un seul acheteur : dans **Commandes**, ouvrez le menu **⋮** de sa commande et choisissez **Message à l'acheteur**."},
        {tip: "La messagerie s'active une fois votre adresse courriel confirmée et Stripe connecté. Avant, vous verrez **Connectez Stripe pour activer la messagerie**."},
        {p: "Les messages servent à informer vos participants sur l'événement : ce n'est pas un outil d'infolettre."},
    ],
};

export const fr: HelpContent = {
    guides: [premierEvenement, stripe, pointage, rembourser, messages],
    questions: [
        {
            question: 'Combien coûte Billetterie Dehors ?',
            answer: "2,5 % par billet vendu, plus les frais de paiement de Stripe (2,9 % + 0,30 $). Pas d'abonnement, pas de frais cachés, et aucuns frais si votre événement est gratuit.\n\nVous préférez que l'acheteur les paie ? Dans **Paramètres de l'événement**, la section **Frais de plateforme** permet de **Répercuter les frais sur l'acheteur**, et **Paiement et facturation** de **Refiler les frais de traitement à l'acheteur**.",
        },
        {
            question: 'Est-ce que j\'ai besoin de Stripe ?',
            answer: "Pour vendre des billets par carte de crédit, oui : voyez [Configurer Stripe pour Billetterie Dehors](/help/configurer-stripe). Pour publier un événement, offrir des billets gratuits ou accepter des **Paiements hors ligne** (virement, argent comptant), non.",
        },
        {
            question: 'Quand est-ce que je reçois mon argent ?',
            answer: "Stripe verse l'argent des ventes directement dans votre compte bancaire. Le premier versement peut prendre jusqu'à 7 jours ; ensuite, c'est en général 2 jours ouvrables.",
        },
        {
            question: 'Mes acheteurs doivent-ils se créer un compte ?',
            answer: "Non. Après l'achat, ils reçoivent un courriel avec leurs billets en PDF (un code QR par billet) et l'événement à ajouter à leur calendrier. Ils retrouvent leurs billets en tout temps dans [Mes billets](/my-tickets), avec le courriel utilisé à l'achat.",
        },
        {
            question: 'Comment rembourser un participant ?',
            answer: "Dans **Commandes**, menu **⋮** de la commande, **Rembourser la commande**. Le remboursement peut être complet ou partiel. Tout est expliqué dans [Rembourser ou annuler une commande](/help/rembourser-annuler).",
        },
        {
            question: 'Comment scanner les billets à l\'entrée ?',
            answer: "Avec une liste de pointage et un téléphone : vos bénévoles ouvrent un lien, sans compte, et scannent les codes QR avec la caméra. Voyez [Le pointage à l'entrée](/help/pointage).",
        },
        {
            question: "Pourquoi mon événement n'apparaît pas sur la page Événements ?",
            answer: "La page [Événements](/events) montre les événements en ligne et à venir. Vérifiez que votre événement est publié (**En ligne - Cliquez pour dépublier** en haut de sa page) et que la page de votre organisateur est aussi en ligne.",
        },
        {
            question: 'Puis-je poser des questions aux participants (taille de chandail, contact d\'urgence) ?',
            answer: "Oui : dans l'événement, ouvrez **Questions d'inscription** et cliquez sur **Ajouter une question**. Les réponses se retrouvent dans la fiche de chaque participant et dans les exports.",
        },
        {
            question: 'Puis-je créer des codes promo ?',
            answer: "Oui : dans l'événement, ouvrez **Codes promo** et cliquez sur **Créer un code promotionnel**. Un code peut donner un rabais en pourcentage ou en dollars, sur certains billets seulement.",
        },
        {
            question: 'Plusieurs personnes peuvent-elles gérer la billetterie ?',
            answer: "Oui. Dans le menu de votre profil, ouvrez **Gestion des utilisateurs** et cliquez sur **Inviter un utilisateur**. Un **Administrateur** a accès à tout ; un **Organisateur** gère les événements et les billets.",
        },
        {
            question: "Que peut faire l'assistant ?",
            answer: "Il connaît la billetterie et lit votre compte : ventes, commandes, participants, réglages. Il peut aussi faire des modifications à votre place (un prix, un code promo, un billet), mais rien ne change avant que vous l'approuviez. Posez-lui votre question en haut de cette page.",
        },
    ],
};
