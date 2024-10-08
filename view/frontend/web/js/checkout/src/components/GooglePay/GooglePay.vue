<template>
  <div
    id="adyen-google-pay"
    :class="!googlePayLoaded ? 'text-loading' : ''"
    :data-cy="'instant-checkout-adyenGooglePay'"
  />
  <div
    v-show="threeDSVisible"
    id="adyen-threeds-container"
  />
</template>

<script>
import { mapActions, mapState } from 'pinia';
import AdyenCheckout from '@adyen/adyen-web';
import useAdyenStore from '../../stores/PaymentStores/AdyenStore';

import clearCartAddresses from '../../helpers/clearCartAddresses';
import getAdyenProductionMode from '../../helpers/getAdyenProductionMode';

import getAdyenPaymentDetails from '../../services/getAdyenPaymentDetails';
import getAdyenPaymentStatus from '../../services/getAdyenPaymentStatus';

import '@adyen/adyen-web/dist/adyen.css';

import loadFromCheckout from '../../helpers/loadFromCheckout';

export default {
  name: 'AdyenGooglePay',
  data() {
    return {
      browserInfo: {},
      googlePayLoaded: false,
      googlePayNoShippingMethods: '',
      key: 'adyenGooglePay',
      orderId: null,
      threeDSVisible: false,
    };
  },
  computed: {
    ...mapState(useAdyenStore, ['getAdyenClientKey', 'isAdyenVersion']),
  },
  async created() {
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

    await configStore.getInitialConfig();
    await this.getInitialConfigValues();
    await cartStore.getCart();

    const paymentMethodsResponse = await this.getPaymentMethodsResponse();
    const googlePayMethod = this.getGooglePayMethod(paymentMethodsResponse);
    if (!googlePayMethod) {
      // Return early if Google Pay isn't enabled in Adyen.
      this.googlePayLoaded = true;
      paymentStore.removeExpressMethod(this.key);
      return;
    }
    const googlePayConfig = paymentMethodsResponse.paymentMethods.find((method) => (
      method.type === 'paywithgoogle' || method.type === 'googlepay'
    ));

    // Early return is Google Pay isn't available.
    if (!googlePayConfig) {
      paymentStore.removeExpressMethod(this.key);
      this.googlePayLoaded = true;
      return;
    }

    const googlePayConfiguration = await this.getGooglePayConfiguration(googlePayConfig);

    const configuration = {
      paymentMethodsResponse,
      clientKey: await this.getAdyenClientKey,
      locale: configStore.locale,
      environment: getAdyenProductionMode() ? 'LIVE' : 'TEST',
      analytics: {
        enabled: false,
      },
      onAdditionalDetails: this.onAdditionalDetails,
    };

    this.checkout = await AdyenCheckout(configuration);
    const googlePayComponent = this.checkout.create('googlepay', googlePayConfiguration);

    googlePayComponent
      .isAvailable()
      .then(() => {
        googlePayComponent.mount('#adyen-google-pay');
        this.googlePayLoaded = true;
      })
      .catch(() => {
        paymentStore.removeExpressMethod(this.key);
        console.warn('Google Pay is not available');
      });

    this.browserInfo = googlePayComponent.browserInfo;
    // Add transation at this point otherwise `$t` is undefined in callbacks.
    this.googlePayNoShippingMethods = this.$t('errorMessages.googlePayNoShippingMethods');
  },
  mounted() {
    const googlePayScript = document.createElement('script');
    googlePayScript.setAttribute('src', 'https://pay.google.com/gp/p/js/pay.js');
    document.head.appendChild(googlePayScript);
  },
  methods: {
    ...mapActions(useAdyenStore, ['getInitialConfigValues', 'getPaymentMethodsResponse']),

    setOrderId(orderId) {
      this.orderId = orderId;
      return orderId;
    },

    async setLoadingState(state) {
      const [loadingStore] = await loadFromCheckout('stores.useLoadingStore');
      loadingStore.setLoadingState(state);
    },

    async setErrorMessage(message) {
      const [paymentStore] = await loadFromCheckout('stores.usePaymentStore');
      paymentStore.setErrorMessage(message);
    },

    getGooglePayMethod(paymentMethodsResponse) {
      return paymentMethodsResponse.paymentMethods.find(({ type }) => (
        type === 'paywithgoogle' || 'googlepay'
      ));
    },

    async handeOnAuthorized() {
      try {
        document.body.classList.remove('gene-checkout-threeds-opened');

        this.setLoadingState(true);
        const response = await getAdyenPaymentStatus(this.orderId);

        this.handleAdyenResponse(response);
      } catch (error) {
        // If the getAdyenPaymentDetails call errors we need to catch it.
        this.setLoadingState(false);
        const message = error.response?.data?.message;
        this.setErrorMessage(message);
      }
    },

    async getGooglePayConfiguration(googlePayConfig) {
      const [
        cartStore,
        configStore,
      ] = await loadFromCheckout([
        'stores.useCartStore',
        'stores.useConfigStore',
      ]);
      const callbackIntents = ['PAYMENT_AUTHORIZATION'];

      if (!cartStore.cart.is_virtual) {
        callbackIntents.push('SHIPPING_ADDRESS', 'SHIPPING_OPTION');
      }

      return {
        amount: {
          value: cartStore.cartGrandTotal,
          currency: configStore.currencyCode,
        },
        countryCode: configStore.countryCode,
        environment: getAdyenProductionMode() ? 'LIVE' : 'TEST',
        paymentDataCallbacks: {
          onPaymentAuthorized: this.onPaymentAuthorized,
          ...(cartStore.cart.is_virtual ? {} : { onPaymentDataChanged: this.onPaymentDataChanged }),
        },
        emailRequired: true,
        shippingAddressRequired: !cartStore.cart.is_virtual,
        shippingAddressParameters: {
          phoneNumberRequired: !cartStore.cart.is_virtual,
        },
        billingAddressRequired: true,
        billingAddressParameters: {
          format: 'FULL',
          phoneNumberRequired: true,
        },
        shippingOptionRequired: !cartStore.cart.is_virtual,
        callbackIntents,
        configuration: {
          gatewayMerchantId: googlePayConfig.configuration.gatewayMerchantId,
          merchantId: googlePayConfig.configuration.merchantId,
        },
        onAuthorized: this.handeOnAuthorized,
        onClick: (resolve, reject) => this.onClick(resolve, reject, googlePayConfig.type),
        onSubmit: () => {},
        onError: async () => {
          clearCartAddresses();
          this.setLoadingState(false);
        },
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

      this.setErrorMessage('');
      // Check that the agreements (if any) and recpatcha is valid.
      const agreementsValid = agreementStore.validateAgreements();
      const recaptchaValid = recaptchaStore.validateToken('placeOrder');

      if (!agreementsValid || !recaptchaValid) {
        return false;
      }

      expressPaymentOnClickDataLayer(type);

      this.setLoadingState(true);

      return resolve();
    },

    onPaymentDataChanged(data) {
      return new Promise(async (resolve) => {
        const [
          formatPrice,
          getShippingMethods,
          cartStore,
          configStore,
          shippingMethodsStore,
        ] = await loadFromCheckout([
          'helpers.formatPrice',
          'services.getShippingMethods',
          'stores.useCartStore',
          'stores.useConfigStore',
          'stores.useShippingMethodsStore',
        ]);
        const address = {
          city: data.shippingAddress.locality,
          country_code: data.shippingAddress.countryCode,
          postcode: data.shippingAddress.postalCode,
          region: data.shippingAddress.administrativeArea,
          region_id: configStore.getRegionId(data.shippingAddress.countryCode, data.shippingAddress.administrativeArea),
          street: ['0'],
          telephone: '000000000',
          firstname: 'UNKNOWN',
          lastname: 'UNKNOWN',
        };

        getShippingMethods(address).then(async (response) => {
          const methods = response.shipping_addresses[0].available_shipping_methods;

          const shippingMethods = methods.map((shippingMethod) => {
            const description = shippingMethod.carrier_title
              ? `${formatPrice(shippingMethod.price_incl_tax.value)} ${shippingMethod.carrier_title}`
              : formatPrice(shippingMethod.price_incl_tax.value);

            return {
              id: shippingMethod.method_code,
              label: shippingMethod.method_title,
              description,
            };
          });

          // Filter out nominated day as this isn't available inside of Google Pay.
          const fShippingMethods = shippingMethods.filter((sid) => sid.id !== 'nominated_delivery');

          // Any error message means we need to exit by resolving with an error state.
          if (!fShippingMethods.length) {
            resolve({
              error: {
                reason: 'SHIPPING_ADDRESS_UNSERVICEABLE',
                message: this.googlePayNoShippingMethods,
                intent: 'SHIPPING_ADDRESS',
              },
            });
            return;
          }

          const selectedShipping = data.shippingOptionData.id === 'shipping_option_unselected'
            ? methods[0]
            : methods.find(({ method_code: id }) => id === data.shippingOptionData.id) || methods[0];

          await shippingMethodsStore.submitShippingInfo(selectedShipping.carrier_code, selectedShipping.method_code);
          this.setLoadingState(true);

          const paymentDataRequestUpdate = {
            newShippingOptionParameters: {
              defaultSelectedOptionId: selectedShipping.method_code,
              shippingOptions: fShippingMethods,
            },
            newTransactionInfo: {
              displayItems: [
                {
                  label: 'Shipping',
                  type: 'LINE_ITEM',
                  price: cartStore.cart.shipping_addresses[0].selected_shipping_method.amount.value.toString(),
                  status: 'FINAL',
                },
              ],
              currencyCode: cartStore.cart.prices.grand_total.currency,
              totalPriceStatus: 'FINAL',
              totalPrice: cartStore.cart.prices.grand_total.value.toString(),
              totalPriceLabel: 'Total',
              countryCode: configStore.countryCode,
            },
          };
          resolve(paymentDataRequestUpdate);
        })
          .catch((error) => {
            resolve({
              error: {
                reason: 'SHIPPING_ADDRESS_UNSERVICEABLE',
                message: error.message,
                intent: 'SHIPPING_ADDRESS',
              },
            });
          });
      });
    },

    onPaymentAuthorized(data) {
      return new Promise(async (resolve) => {
        const [
          createPaymentGraphQl,
          setAddressesOnCart,
          cartStore,
        ] = await loadFromCheckout([
          'services.createPaymentGraphQl',
          'services.setAddressesOnCart',
          'stores.useCartStore',
        ]);

        // If there is no select shipping method at this point display an error.
        if (!cartStore.cart.is_virtual && !cartStore.cart.shipping_addresses[0].selected_shipping_method) {
          resolve({
            error: {
              reason: 'SHIPPING_OPTION_INVALID',
              message: 'No shipping method selected',
              intent: 'SHIPPING_OPTION',
            },
          });
          return;
        }

        const { email } = data;
        const { billingAddress } = data.paymentMethodData.info;
        const { phoneNumber: billingPhoneNumber } = billingAddress;
        const mapBillingAddress = await this.mapAddress(billingAddress, email, billingPhoneNumber);

        let mapShippingAddress = null;

        if (!cartStore.cart.is_virtual) {
          const { shippingAddress } = data;
          const { phoneNumber: shippingPhoneNumber } = shippingAddress;
          mapShippingAddress = await this.mapAddress(shippingAddress, email, shippingPhoneNumber);
        }

        setAddressesOnCart(mapShippingAddress, mapBillingAddress, email)
          .then(() => {
            const stateData = JSON.stringify({
              paymentMethod: {
                googlePayCardNetwork: data.paymentMethodData.info.cardNetwork,
                googlePayToken: data.paymentMethodData.tokenizationData.token,
                type: 'googlepay',
              },
              browserInfo: this.browserInfo,
            });

            const additionalDataKey = this.isAdyenVersion('9') ? 'adyen_additional_data' : 'adyen_additional_data_hpp';

            const paymentMethod = {
              code: this.isAdyenVersion('9') ? 'adyen_googlepay' : 'adyen_hpp',
              [additionalDataKey]: {
                brand_code: 'googlepay',
                stateData,
              },
            };
            return paymentMethod;
          })
          .then(createPaymentGraphQl)
          .then((orderNumber) => {
            this.setOrderId(orderNumber);
            resolve({
              transactionState: 'SUCCESS',
            });
          })
          .catch((error) => {
            resolve({
              error: {
                reason: 'PAYMENT_DATA_INVALID',
                message: error.message,
                intent: 'PAYMENT_AUTHORIZATION',
              },
            });
          });
      });
    },

    async handleAdyenResponse(response) {
      if (response.isFinal) {
        const approvedCodes = [
          'Authorised',
          'Received',
          'PresentToShopper',
        ];
        if (approvedCodes.includes(response.resultCode)) {
          const [
            getCartSectionNames,
            getSuccessPageUrl,
            refreshCustomerData,
          ] = await loadFromCheckout([
            'helpers.getCartSectionNames',
            'helpers.getSuccessPageUrl',
            'services.refreshCustomerData',
          ]);

          await refreshCustomerData(getCartSectionNames());
          window.location.href = getSuccessPageUrl();
        } else {
          this.setLoadingState(false);
        }
      } else if (response.action) {
        // If the action is 3DS related then add a class globally so we can display as popup.
        if (response.action.type === 'threeDS2') {
          document.body.classList.add('gene-checkout-threeds-opened');
        }

        const threeDSConfiguration = {
          challengeWindowSize: '05',
        };

        this.threeDSVisible = true;
        this.checkout.createFromAction(response.action, threeDSConfiguration).mount('#adyen-threeds-container');
      }
    },

    async onAdditionalDetails(state, component) {
      try {
        document.body.classList.remove('gene-checkout-threeds-opened');
        const request = state.data ? state.data : {};
        request.orderId = this.orderId;
        const response = await getAdyenPaymentDetails(JSON.stringify(request));
        await this.handleAdyenResponse(response, component);
      } catch (error) {
        // If the getAdyenPaymentDetails call errors we need to catch it.
        const { message } = error;
        this.setLoadingState(false);
        this.setErrorMessage(message);
      }
    },

    async mapAddress(address, email, telephone) {
      const [configStore] = await loadFromCheckout('stores.useConfigStore');

      const [firstname, ...lastname] = address.name.split(' ');
      const regionId = configStore.getRegionId(address.countryCode, address.administrativeArea);

      return {
        street: [
          address.address1,
          address.address2,
        ],
        company: address.company || '',
        postcode: address.postalCode,
        country_code: address.countryCode,
        email,
        firstname,
        lastname: lastname.length ? lastname.join(' ') : 'UNKNOWN',
        city: address.locality,
        telephone,
        region: {
          ...(address.administrativeArea ? { region: address.administrativeArea } : {}),
          ...(regionId ? { region_id: regionId } : {}),
        },
      };
    },
  },
};
</script>

<style lang="scss">
@import "./GooglePayStyles.scss";
</style>
