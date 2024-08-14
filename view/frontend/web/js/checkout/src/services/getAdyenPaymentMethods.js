import loadFromCheckout from '../helpers/loadFromCheckout';

function transformGraphqlExtraDetails(paymentMethodsExtraDetails) {
  const transformedData = paymentMethodsExtraDetails?.map((item) => ({
    [item.type]: {
      icon: item.icon,
      isOpenInvoice: item.isOpenInvoice,
      configuration: item.configuration,
    },
  })) || [];

  return Object.assign({}, ...transformedData);
}

export default async () => {
  const [
    graphQlRequest,
    cartStore,
    configStore,
  ] = await loadFromCheckout([
    'services.graphQlRequest',
    'stores.useCartStore',
    'stores.useConfigStore',
  ]);

  const { maskedId, getMaskedId } = cartStore;
  const { storeCode } = configStore;

  let cartId;
  if (!maskedId) {
    cartId = await getMaskedId();
  } else {
    cartId = maskedId;
  }

  const request = ` {
    adyenPaymentMethods(cart_id: "${cartId}", shopper_locale: "${storeCode}") {
        paymentMethodsExtraDetails {
            type
            icon {
                url
                width
                height
            }
            isOpenInvoice
            configuration {
                amount {
                    value
                    currency
                }
                currency
            }
        }
        paymentMethodsResponse {
            paymentMethods {
                name
                type
                brand
                brands
                configuration {
                    merchantId
                    merchantName
                    gatewayMerchantId
                }
                details {
                    key
                    type
                    items {
                        id
                        name
                    }
                    optional
                }
            }
            storedPaymentMethods {
              id
              brand
              expiryMonth
              expiryYear
              holderName
              lastFour
              name
              ownerName
              networkTxReference
              type
              supportedShopperInteractions
            }
        }
    }
}`;

  return graphQlRequest(request)
    .then((response) => ({
      paymentMethodsExtraDetails:
        transformGraphqlExtraDetails(response.data.adyenPaymentMethods.paymentMethodsExtraDetails),
      paymentMethodsResponse: response.data.adyenPaymentMethods.paymentMethodsResponse || {
        paymentMethods: [],
      },
    }));
};
