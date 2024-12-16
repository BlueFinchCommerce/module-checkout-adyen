import loadFromCheckout from '../helpers/loadFromCheckout';

export default async (payload) => {
  const [
    graphQlRequest,
    cartStore,
  ] = await loadFromCheckout([
    'services.graphQlRequest',
    'stores.useCartStore',
  ]);

  const { maskedId } = cartStore;

  const request = `
    mutation getAdyenPaymentDetails($payload: String!, $cartId: String!) {
      adyenPaymentDetails(payload:  $payload, cart_id: $cartId) {
        isFinal
        resultCode
        additionalData
        action
      }
  }`;

  const variables = {
    cartId: maskedId,
    payload,
  };

  return graphQlRequest(request, variables, {}, 'BetterCheckoutAdyenPaymentDetails')
    .then((response) => {
      if (response.errors) {
        throw new Error(response.errors[0].message);
      }

      return response.data.adyenPaymentDetails;
    });
};
