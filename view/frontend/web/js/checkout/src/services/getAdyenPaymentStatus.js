import loadFromCheckout from '../helpers/loadFromCheckout';

export default async (orderId) => {
  const [
    graphQlRequest,
    cartStore,
  ] = await loadFromCheckout([
    'services.graphQlRequest',
    'stores.useCartStore',
  ]);
  const { maskedId, getMaskedId } = cartStore;

  let cartId;
  if (!maskedId) {
    cartId = await getMaskedId();
  } else {
    cartId = maskedId;
  }

  const request = ` {
    adyenPaymentStatus(orderNumber: "${orderId}", cartId: "${cartId}") {
      action
      additionalData
      isFinal
      resultCode
    }
  } `;

  return graphQlRequest(request, {}, {}, 'BetterCheckoutAdyenPaymentStatus')
    .then((response) => ({
      ...response.data.adyenPaymentStatus,
      action: JSON.parse(response.data.adyenPaymentStatus.action),
    }));
};
