import { defineStore } from 'pinia';

import getAdyenPaymentMethods from '../../services/getAdyenPaymentMethods';

import getAdyenProductionMode from '../../helpers/getAdyenProductionMode';
import loadFromCheckout from '../../helpers/loadFromCheckout';

export default defineStore('adyenStore', {
  state: () => ({
    cache: {},
    clientToken: null,
    paymentTypes: [],
    adyenEnvironmentMode: 'live',
    adyenVaultEnabled: false,
    recurringConfiguration: {},
    keyLive: '',
    keyTest: '',
    version: '',
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
    getAdyenClientKey: async (state) => (
      await getAdyenProductionMode() ? state.keyLive : state.keyTest
    ),
    isAdyenVersion: (state) => (
      (version) => (
        state.version.startsWith(version)
      )
    ),
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
          adyen_version_number
        }
      }`).then(this.handleInitialConfig).then(this.getVaultConfig);

      await this.getCachedResponse(request, 'getInitialConfig');
    },

    async handleInitialConfig(config) {
      const [
        paymentStore,
      ] = await loadFromCheckout([
        'stores.usePaymentStore',
      ]);
      const { availableMethods } = paymentStore;
      const vaultActive = this.isAdyenVersion('9')
        ? availableMethods.some(({ code }) => code.includes('adyen_cc_vault'))
        : config.data.storeConfig.adyen_vault_enabled;

      if (config?.data?.storeConfig) {
        this.setData({
          // Adyen's modes are '0' = live, '1' = test.
          adyenEnvironmentMode: config.data.storeConfig.adyen_environment_mode === '0' ? 'live' : 'test',
          adyenVaultEnabled: vaultActive,
          keyLive: config.data.storeConfig.adyen_client_key_live,
          keyTest: config.data.storeConfig.adyen_client_key_test,
          version: config.data.storeConfig.adyen_version_number,
        });
      }
    },

    async getVaultConfig() {
      const [
        graphQlRequest,
      ] = await loadFromCheckout([
        'services.graphQlRequest',
      ]);

      const config = this.isAdyenVersion('9')
        ? 'recurring_configuration'
        : 'adyen_vault_enabled';

      return graphQlRequest(`{
        storeConfig {
          ${config}
        }
      }`).then(({ data: { storeConfig } }) => {
        if (this.isAdyenVersion('9')) {
          this.setData({
            recurringConfiguration: JSON.parse(storeConfig.recurring_configuration),
          });
        } else {
          this.setData({
            adyenVaultEnabled: storeConfig.adyen_vault_enabled,
          });
        }
      });
    },

    async getPaymentMethodsResponse() {
      const {
        paymentMethodsExtraDetails,
        paymentMethodsResponse,
      } = await getAdyenPaymentMethods();

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

    async goToAdyenAmazonReview() {
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
      this.$router.push('/adyen-amazon-review');
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
