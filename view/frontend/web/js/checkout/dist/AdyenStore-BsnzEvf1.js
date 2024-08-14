import { d as defineStore } from './pinia-D5d2y-Sp.js';
import { l as loadFromCheckout } from './loadFromCheckout-CpEUBppu.js';

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

var getAdyenPaymentMethods = async () => {
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

var getAdyenProductionMode = () => {
  const { adyenEnvironmentMode } = useAdyenStore();
  return adyenEnvironmentMode === 'live';
};

var useAdyenStore = defineStore('adyenStore', {
  state: () => ({
    cache: {},
    clientToken: null,
    paymentTypes: [],
    adyenEnvironmentMode: 'live',
    adyenVaultEnabled: false,
    keyLive: '',
    keyTest: '',
  }),
  getters: {
    isAdyenAvailable: async () => {
      const [
        paymentStore,
      ] = await loadFromCheckout([
        'stores.usePaymentStore',
      ]);
      const { availableMethods } = paymentStore;
      return availableMethods.some(({ code }) => code.includes('adyen'));
    },
    getAdyenClientKey: async (state) => {
      console.log(await getAdyenProductionMode());
      return await getAdyenProductionMode() ? state.keyLive : state.keyTest;
    },
  },
  actions: {
    setData(data) {
      this.$patch(data);
    },

    async getInitialConfigValues() {
      const [
        graphQlRequest,
      ] = await loadFromCheckout([
        'services.graphQlRequest',
      ]);

      const request = async () => graphQlRequest(`{
        storeConfig {
          adyen_environment_mode
          adyen_vault_enabled
          adyen_client_key_live
          adyen_client_key_test
        }
      }`).then(this.handleInitialConfig);

      await this.getCachedResponse(request, 'getInitialConfig');
    },

    handleInitialConfig(config) {
      if (config?.data?.storeConfig) {
        this.setData({
          // Adyen's modes are '0' = live, '1' = test.
          adyenEnvironmentMode: config.data.storeConfig.adyen_environment_mode === '0' ? 'live' : 'test',
          adyenVaultEnabled: config.data.storeConfig.adyen_vault_enabled,
          keyLive: config.data.storeConfig.adyen_client_key_live,
          keyTest: config.data.storeConfig.adyen_client_key_test,
        });
      }
    },

    async getPaymentMethodsResponse() {
      const request = async () => getAdyenPaymentMethods();
      const {
        paymentMethodsExtraDetails,
        paymentMethodsResponse,
      } = await this.getCachedResponse(request, 'getAdyenPaymentMethods');

      // Store the payment methods and icons.
      !this.paymentTypes.length && paymentMethodsResponse.paymentMethods.forEach((method) => {
        const { paymentTypes } = this;
        if (method.type === 'scheme') {
          method.brands.forEach((brand) => {
            paymentTypes.push({
              name: method.name,
              icon: `https://checkoutshopper-live.adyen.com/checkoutshopper/images/logos/${brand}.svg`,
            });
          });
        } else {
          paymentTypes.push({
            name: method.name,
            icon: paymentMethodsExtraDetails[method.type].icon.url,
          });
        }

        this.setData({
          paymentTypes,
        });
      });

      if (paymentMethodsResponse.storedPaymentMethods) {
        const [
          paymentStore,
        ] = await loadFromCheckout([
          'stores.usePaymentStore',
        ]);

        paymentStore.setHasVaultedMethods();
      }

      return paymentMethodsResponse;
    },

    async goToAdyenAmazonReviw() {
      const [
        stepsStore,
      ] = await loadFromCheckout([
        'stores.useStepsStore',
      ]);
      stepsStore.setData({
        yourDetailsActive: true,
        shippingActive: true,
        paymentActive: true,
      });
      // this.$router.push('/adyen-amazon-review');
    },

    getCachedResponse(request, cacheKey, args = {}) {
      if (typeof this.$state.cache[cacheKey] !== 'undefined') {
        return this.$state.cache[cacheKey];
      }

      const data = request(args);
      this.$patch({
        cache: {
          [cacheKey]: data,
        },
      });
      return data;
    },

    clearPaymentReponseCache() {
      this.clearCaches(['getAdyenPaymentMethods']);
    },

    clearCaches(cacheKeys) {
      if (cacheKeys.length) {
        cacheKeys.forEach((cacheKey) => {
          this.setData({
            cache: {
              [cacheKey]: undefined,
            },
          });
        });
      }
    },
  },
});

export { getAdyenProductionMode as g, useAdyenStore as u };
