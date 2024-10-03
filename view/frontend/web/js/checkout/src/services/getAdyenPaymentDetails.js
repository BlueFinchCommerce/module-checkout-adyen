import loadFromCheckout from '../helpers/loadFromCheckout';

export default async (payload, orderId) => {
  const [
    buildCartUrl,
    authenticatedRequest,
    graphQlRequest,
    cartStore,
  ] = await loadFromCheckout([
    'helpers.buildCartUrl',
    'services.authenticatedRequest',
    'services.graphQlRequest',
    'stores.useCartStore',
  ]);
  // const url = buildCartUrl('payments-details').replace('V1/', 'V1/adyen/');

  // return authenticatedRequest().post(url, { formKey: '', payload, orderId })
  //   .then((response) => response.data)
  //   .then((response) => JSON.parse(response));

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

  return graphQlRequest(request, variables)
    .then((response) => response.data.adyenPaymentDetails);
};
