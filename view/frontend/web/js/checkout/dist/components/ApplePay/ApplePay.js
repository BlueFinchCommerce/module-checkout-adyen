import { m as mapState, a as mapActions } from '../../pinia-D5d2y-Sp.js';
import { r as rN } from '../../index-BvxV4WF7.js';
import { g as getAdyenProductionMode, u as useAdyenStore } from '../../AdyenStore-BsnzEvf1.js';
import { l as loadFromCheckout } from '../../loadFromCheckout-CpEUBppu.js';
import { c as createElementBlock, n as normalizeClass, e as createCommentVNode, o as openBlock } from '../../runtime-core.esm-bundler-Rf9YpmoW.js';

var script = {
  name: 'AdyenApplePay',

  data() {
    return {
      applePayAvailable: false,
      applePayTotal: '',
      applPaySubtotaltitle: '',
      applePayShippingStepTitle: '',
      applePayNoShippingMethods: '',
      applePayLoaded: true,
      key: 'adyenApplePay',
    };
  },

  computed: {
    ...mapState(useAdyenStore, ['getAdyenClientKey']),
  },

  async created() {
    // If the browser doesn't support Apple Pay then return early.
    if (!window.ApplePaySession || !window.ApplePaySession.canMakePayments) {
      return;
    }

    const [
      cartStore,
      configStore,
      paymentStore,
    ] = await loadFromCheckout([
      'stores.useCartStore',
      'stores.useConfigStore',
      'stores.usePaymentStore',
    ]);

    paymentStore.addExpressMethod(this.key);
    this.applePayLoaded = false;
    this.applePayAvailable = true;

    await configStore.getInitialConfig();
    await this.getInitialConfigValues();
    await cartStore.getCart();

    const paymentMethodsResponse = await this.getPaymentMethodsResponse();

    const applePayMethod = this.getApplePayMethod(paymentMethodsResponse);

    if (!applePayMethod) {
      // Return early if Apple Pay isn't enabled in Adyen.
      this.applePayLoaded = true;
      paymentStore.removeExpressMethod(this.key);
      return;
    }

    const applePayConfiguration = await this.getApplePayConfiguration(applePayMethod);
    const configuration = {
      configStore: this.locale,
      environment: getAdyenProductionMode() ? 'LIVE' : 'TEST',
      analytics: {
        enabled: false,
      },
      risk: {
        enabled: false,
      },
      clientKey: this.getAdyenClientKey,
    };
    const checkout = await rN(configuration);
    const applePayComponent = checkout.create('applepay', applePayConfiguration);
    applePayComponent
      .isAvailable()
      .then(() => {
        applePayComponent.mount('#adyen-apple-pay');
        this.applePayLoaded = true;
      })
      .catch(() => {
        paymentStore.removeExpressMethod(this.key);
        console.warn('Apple Pay is not available');
      });

    this.applePayTotal = configStore.websiteName;
    this.applPaySubtotaltitle = this.$t('orderSummary.subtotalTitle');
    this.applePayShippingStepTitle = this.$t('progressBar.shippingStepTitle');
    this.applePayNoShippingMethods = this.$t('errorMessages.applePayNoShippingMethods');
  },

  methods: {
    ...mapActions(useAdyenStore, [
      'getInitialConfigValues',
      'getPaymentMethodsResponse',
    ]),

    getApplePayMethod(paymentMethodsResponse) {
      return paymentMethodsResponse.paymentMethods.find(({ type }) => (
        type === 'applepay'
      ));
    },

    async getApplePayConfiguration(applePayMethod) {
      const [
        cartStore,
        configStore,
      ] = await loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);

      const requiredShippingContactFields = ['name', 'email', 'phone'];

      if (!cartStore.cart.is_virtual) {
        requiredShippingContactFields.push('postalAddress');
      }

      return {
        amount: {
          value: parseFloat(cartStore.cartGrandTotal).toFixed(2),
          currency: configStore.currencyCode,
        },
        currencyCode: configStore.currencyCode,
        countryCode: configStore.countryCode,
        totalPriceLabel: configStore.websiteName,
        environment: getAdyenProductionMode() ? 'LIVE' : 'TEST',
        configuration: {
          domainName: window.location.hostname,
          merchantName: applePayMethod.configuration.merchantName,
          merchantId: applePayMethod.configuration.merchantId,
        },
        requiredShippingContactFields,
        requiredBillingContactFields: ['postalAddress', 'name'],
        onAuthorized: this.onAuthorized.bind(this),
        ...(cartStore.cart.is_virtual ? {} : {
          onShippingContactSelected: this.onShippingContactSelect.bind(this),
          onShippingMethodSelected: this.onShippingMethodSelect.bind(this),
          shippingMethods: [],
        }),
        onClick: (resolve, reject) => this.onClick(resolve, reject, applePayMethod.type),
        onSubmit: () => {},
      };
    },

    async onClick(resolve, reject, type) {
      const [
        expressPaymentOnClickDataLayer,
        agreementStore,
        recaptchaStore,
      ] = await loadFromCheckout([
        'helpers.expressPaymentOnClickDataLayer',
        'stores.useAgreementStore',
        'stores.useRecaptchaStore',
      ]);

      // Check that the agreements (if any) and recpatcha is valid.
      const agreementsValid = agreementStore.validateAgreements();
      const recaptchaValid = recaptchaStore.validateToken('placeOrder');

      if (!agreementsValid || !recaptchaValid) {
        return false;
      }

      expressPaymentOnClickDataLayer(type);

      return resolve();
    },

    async onAuthorized(resolve, reject, data) {
      const [
        getCartSectionNames,
        getSuccessPageUrl,
        createPaymentGraphQl,
        refreshCustomerData,
        setAddressesOnCart,
        cartStore,
        configStore,
      ] = await loadFromCheckout([
        'helpers.getCartSectionNames',
        'helpers.getSuccessPageUrl',
        'services.createPaymentGraphQl',
        'services.refreshCustomerData',
        'services.setAddressesOnCart',
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);

      const { shippingContact, billingContact } = data.payment;

      const email = shippingContact.emailAddress;
      const telephone = shippingContact.phoneNumber;

      let shippingAddress = null;

      if (!cartStore.cart.is_virtual) {
        shippingAddress = await this.mapAddress(shippingContact, email, telephone);
      }

      const billingAddress = await this.mapAddress(billingContact, email, telephone);

      if (!configStore.countries.some(({ id }) => id === billingAddress.country_code)) {
        reject(window.ApplePaySession.STATUS_FAILURE);
        return;
      }

      try {
        setAddressesOnCart(shippingAddress, billingAddress, email)
          .then(() => {
            const stateData = JSON.stringify({
              paymentMethod: {
                applePayToken: btoa(JSON.stringify(data.payment.token.paymentData)),
                type: 'applepay',
              },
              browserInfo: this.browserInfo,
            });

            const paymentMethod = {
              code: 'adyen_hpp',
              adyen_additional_data_hpp: {
                brand_code: 'applepay',
                stateData,
              },
            };

            return createPaymentGraphQl(paymentMethod);
          })
          .then(async () => {
            resolve(window.ApplePaySession.STATUS_SUCCESS);
            await refreshCustomerData(getCartSectionNames());
            window.location.href = getSuccessPageUrl();
          });
      } catch (error) {
        const errors = {
          errors: [
            new window.ApplePayError('unknown', 'country', error.message),
          ],
        };

        resolve(errors);
      }
    },

    async onShippingContactSelect(resolve, reject, data) {
      const [
        getShippingMethods,
        cartStore,
        configStore,
        shippingMethodsStore,
      ] = await loadFromCheckout([
        'services.getShippingMethods',
        'stores.useCartStore',
        'stores.useConfigStore',
        'stores.useShippingMethodsStore',
      ]);
      const address = {
        city: data.shippingContact.locality,
        region: data.shippingContact.administrativeArea,
        region_id: configStore.getRegionId(data.shippingContact.countryCode, data.shippingContact.administrativeArea),
        country_code: data.shippingContact.countryCode.toUpperCase(),
        postcode: data.shippingContact.postalCode,
        street: ['0'],
        telephone: '000000000',
        firstname: 'UNKNOWN',
        lastname: 'UNKNOWN',
      };

      this.address = address;

      const result = await getShippingMethods(address);
      const methods = result.shipping_addresses[0].available_shipping_methods;

      const filteredMethods = methods.filter(({ method_code: methodCode }) => (
        methodCode !== 'nominated_delivery'
      ));

      // If there are no shipping methods available show an error.
      if (!filteredMethods.length) {
        const errors = {
          errors: [
            new window.ApplePayError('addressUnserviceable', 'postalAddress', this.applePayNoShippingMethods),
          ],
          newTotal: {
            label: this.applePayTotal,
            amount: '0.00',
            type: 'pending',
          },
        };
        resolve(errors);
        return;
      }

      // Set the shipping method back to the first available method.
      const selectedShipping = filteredMethods[0];

      await shippingMethodsStore.submitShippingInfo(selectedShipping.carrier_code, selectedShipping.method_code);
      const newShippingMethods = this.mapShippingMethods(filteredMethods);
      const applePayShippingContactUpdate = {
        newShippingMethods,
        newTotal: {
          label: this.applePayTotal,
          amount: parseFloat(cartStore.cartGrandTotal / 100).toFixed(2),
        },
        newLineItems: [
          {
            type: 'final',
            label: 'Subtotal',
            amount: cartStore.cart.prices.subtotal_including_tax.value.toString(),
          },
          {
            type: 'final',
            label: 'Shipping',
            amount: selectedShipping.amount.value.toString(),
          },
        ],
      };

      // Add discount price if available.
      if (cartStore.cartDiscountTotal) {
        applePayShippingContactUpdate.newLineItems.push({
          type: 'final',
          label: 'Discount',
          amount: cartStore.cartDiscountTotal.toString(),
        });
      }

      resolve(applePayShippingContactUpdate);
    },

    async onShippingMethodSelect(resolve, reject, data) {
      const [
        cartStore,
        shippingMethodsStore,
      ] = await loadFromCheckout([
        'stores.useCartStore',
        'stores.useShippingMethodsStore',
      ]);

      const selectedShipping = shippingMethodsStore.shippingMethods.find(({ method_code: id }) => (
        id === data.shippingMethod.identifier
      ));

      await shippingMethodsStore.submitShippingInfo(selectedShipping.carrier_code, selectedShipping.method_code);
      const applePayShippingContactUpdate = {
        newTotal: {
          label: this.applePayTotal,
          amount: parseFloat(cartStore.cartGrandTotal / 100).toFixed(2),
        },
        newLineItems: [
          {
            type: 'final',
            label: 'Subtotal',
            amount: cartStore.cart.prices.subtotal_including_tax.value.toString(),
          },
          {
            type: 'final',
            label: 'Shipping',
            amount: selectedShipping.amount.value.toString(),
          },
        ],
      };

      // Add discount price if available.
      if (cartStore.cartDiscountTotal) {
        applePayShippingContactUpdate.newLineItems.push({
          type: 'final',
          label: 'Discount',
          amount: cartStore.cartDiscountTotal.toString(),
        });
      }

      resolve(applePayShippingContactUpdate);
    },

    mapShippingMethods(shippingMethods) {
      return shippingMethods.map((shippingMethod) => (
        {
          label: shippingMethod.method_title,
          detail: shippingMethod.carrier_title || '',
          amount: shippingMethod.amount.toString(),
          identifier: shippingMethod.method_code,
          carrierCode: shippingMethod.carrier_code,
        }
      ));
    },

    // Map the address provided by ApplePay into something useable.
    async mapAddress(address, email, telephone) {
      const [
        configStore,
      ] = await loadFromCheckout([
        'stores.useConfigStore',
      ]);

      const regionId = configStore.getRegionId(address.countryCode.toUpperCase(), address.administrativeArea);
      return {
        email,
        telephone,
        firstname: address.givenName,
        lastname: address.familyName,
        company: address.company || '',
        street: address.addressLines,
        city: address.locality,
        country_code: address.countryCode.toUpperCase(),
        postcode: address.postalCode,
        region: {
          ...(address.administrativeArea ? { region: address.administrativeArea } : {}),
          ...(regionId ? { region_id: regionId } : {}),
        },
      };
    },
  },
};

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return ($data.applePayAvailable)
    ? (openBlock(), createElementBlock("div", {
        key: 0,
        id: "adyen-apple-pay",
        class: normalizeClass(!$data.applePayLoaded ? 'text-loading' : ''),
        "data-cy": 'instant-checkout-adyenApplePay'
      }, null, 2 /* CLASS */))
    : createCommentVNode("v-if", true)
}

script.render = render;
script.__file = "src/components/ApplePay/ApplePay.vue";

export { script as default };
