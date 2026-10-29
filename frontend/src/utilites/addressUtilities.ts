import {Event, VenueAddress} from "../types.ts";

export const isAddressSet = (address?: VenueAddress) => {
    if (!address) return false;

    const addressFields: (keyof VenueAddress)[] = [
        'address_line_1',
        'address_line_2',
        'city',
        'state_or_region',
        'zip_or_postal_code',
        'country'
    ];

    return addressFields.some(field => address[field])
}

export const formatAddress = (address: VenueAddress) => {
    const addressLines = [
        address.address_line_1,
        address.address_line_2,
        address.city,
        address.state_or_region,
        address.zip_or_postal_code,
        address.country
    ];

    return addressLines.filter((line) => line).join(', ');
}

export const getShortLocationDisplay = (locationDetails?: VenueAddress) => {
    if (!locationDetails) return null;

    const parts = [];
    if (locationDetails.venue_name) {
        parts.push(locationDetails.venue_name);
    }
    if (locationDetails.city) {
        parts.push(locationDetails.city);
    }

    return parts.length > 0 ? parts.join(', ') : null;
};

export const getGoogleMapsUrl = (locationDetails: VenueAddress) => {
    if (!locationDetails) return '';
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(formatAddress(locationDetails))}`;
};

// Le lieu d'un evenement sur place (salle, adresse) et son lien d'itineraire; rien en ligne ou sans adresse.
export const eventLocation = (event: Event) => {
    const details = event.settings?.location_details;

    if (event.settings?.is_online_event || !details || (!isAddressSet(details) && !details.venue_name)) {
        return null;
    }

    const address = formatAddress(details);
    const query = [details.venue_name, address].filter(Boolean).join(', ');

    return {
        title: details.venue_name || address,
        subtitle: details.venue_name ? address : null,
        mapsUrl: event.settings?.maps_url || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`,
    };
};
