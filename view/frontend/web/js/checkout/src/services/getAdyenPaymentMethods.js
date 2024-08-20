import loadFromCheckout from '../helpers/loadFromCheckout';

export default async () => {
  const [
    buildCartUrl,
    authenticatedRequest,

  ] = await loadFromCheckout([
    'helpers.buildCartUrl',
    'services.authenticatedRequest',
  ]);

  return authenticatedRequest().post(buildCartUrl('retrieve-adyen-payment-methods'))
    .then((response) => response.data)
    .then((response) => JSON.parse(response));
};
