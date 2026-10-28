// Billetterie Dehors vend en dollars canadiens, en euros et en dollars americains:
// toutes les listes de devises s'en tiennent a ces trois-la, le CAD en tete.
export const currencies = {
    "Canadian Dollar": "CAD",
    "Euro": "EUR",
    "United States Dollar": "USD",
};

export const currenciesMap = Object.entries(currencies).map(([k, v]) => ({
    value: v,
    label: k,
}));
