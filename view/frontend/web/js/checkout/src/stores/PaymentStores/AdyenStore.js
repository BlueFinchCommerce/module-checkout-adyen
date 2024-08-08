import { defineStore } from 'pinia';

import loadFromCheckout from '../../helpers/loadFromCheckout';

export default defineStore('adyenStore', {
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
      const [
        getAdyenProductionMode,
      ] = await loadFromCheckout([
        'helpers.getAdyenProductionMode',
      ]);
      return getAdyenProductionMode() ? state.keyLive : state.keyTest;
    },
  },
  actions: {
    setData(data) {
      this.$patch(data);
    },

    getInitialConfigValues() {
      return `
        storeConfig {
          adyen_environment_mode
          adyen_vault_enabled
          adyen_client_key_live
          adyen_client_key_test
        }
      `;
    },

    handleInitialConfig({ storeConfig }) {
      if (storeConfig) {
        this.setData({
          // Adyen's modes are '0' = live, '1' = test.
          adyenEnvironmentMode: storeConfig.adyen_environment_mode === '0' ? 'live' : 'test',
          adyenVaultEnabled: storeConfig.adyen_vault_enabled,
          keyLive: storeConfig.adyen_client_key_live,
          keyTest: storeConfig.adyen_client_key_test,
        });
      }
    },

    async getPaymentMethodsResponse() {
      const [
        getAdyenPaymentMethods,
      ] = await loadFromCheckout([
        'services.getAdyenPaymentMethods',
      ]);

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
