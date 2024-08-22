<template>
  <div class="payment-step">
    <component :is="SavedDeliveryAddress" />
    <component :is="SavedShippingMethod" />
    <div class="payment-page">
      <div class="payment-form">
        <div id="amazonpay_order-container" />
        <button
          v-if="state === 'loading'"
          class="adyen-checkout__button adyen-checkout__button--pay adyen-checkout__button--loading"
          type="button"
          disabled=""
        >
          <div class="adyen-checkout__spinner__wrapper ">
            <div class="adyen-checkout__spinner adyen-checkout__spinner--medium" />
          </div>
        </button>
        <div
          v-else-if="state === 'error'"
          class="adyen-checkout__status adyen-checkout__status--error"
        >
          <img
            class="adyen-checkout__status__icon adyen-checkout__image adyen-checkout__image--loaded"
            src="https://checkoutshopper-test.adyen.com/checkoutshopper/images/components/error.gif"
            alt="An unknown error occurred"
            height="88"
          >
          <span class="adyen-checkout__status__text">{{ errorMessage }}</span>
        </div>
        <div
          v-else
          class="adyen-checkout__status adyen-checkout__status--success"
        >
          <img
            height="88"
            class="adyen-checkout__status__icon adyen-checkout__image adyen-checkout__image--loaded"
            src="https://checkoutshopper-test.adyen.com/checkoutshopper/images/components/success.gif"
            alt="Payment Successful"
          >
          <span class="adyen-checkout__status__text">{{ $t('adyen.paymentSuccessful') }}</span>
        </div>
      </div>
    </div>
  </div>
</template>
<script>
// Stores
import { mapActions, mapState } from 'pinia';
import useAdyenStore from '../../stores/PaymentStores/AdyenStore';

import AdyenCheckout from '@adyen/adyen-web';
import '@adyen/adyen-web/dist/adyen.css';

// Services
import getAdyenPaymentStatus from '../../services/getAdyenPaymentStatus';
import getAdyenPaymentDetails from '../../services/getAdyenPaymentDetails';

// Helpers
import getAdyenProductionMode from '../../helpers/getAdyenProductionMode';

import loadFromCheckout from '../../helpers/loadFromCheckout';

export default {
  name: 'AdyenAmazonReview',
  data() {
    return {
      orderId: null,
      state: 'loading',
      errorMessage: '',
      SavedDeliveryAddress: null,
      SavedShippingMethod: null,
    };
  },
  computed: {
    ...mapState(useAdyenStore, ['getAdyenClientKey', 'isAdyenVersion']),
  },
  async created() {
    const [
      SavedDeliveryAddress,
      SavedShippingMethod,
      getUrlQuery,
      createPaymentGraphQl,
      cartStore,
      configStore,
    ] = await loadFromCheckout([
      'components.SavedDeliveryAddress',
      'components.SavedShippingMethod',
      'helpers.getUrlQuery',
      'services.createPaymentGraphQl',
      'stores.useCartStore',
      'stores.useConfigStore',
    ]);

    this.SavedDeliveryAddress = SavedDeliveryAddress;
    this.SavedShippingMethod = SavedShippingMethod;
    // Get the Amazon checkout sessionID.
    const amazonCheckoutSessionId = getUrlQuery('amazonCheckoutSessionId');

    await configStore.getInitialConfig();
    await this.getInitialConfigValues();
    await cartStore.getCart();

    const paymentMethodsResponse = await this.getPaymentMethodsResponse();
    const configuration = {
      paymentMethodsResponse,
      clientKey: await this.getAdyenClientKey,
      amount: {
        value: cartStore.cartGrandTotal,
        currency: configStore.currencyCode,
      },
      locale: configStore.locale,
      environment: getAdyenProductionMode() ? 'live' : 'test',
      analytics: {
        enabled: false,
      },
      onAdditionalDetails: this.handleAdditionalDetails.bind(this),
      onSubmit: (state, component) => {
        this.state = 'loading';

        const paymentMethod = this.getPaymentMethod(state);

        createPaymentGraphQl(paymentMethod)
          .then(this.setOrderId)
          .then(getAdyenPaymentStatus)
          .then((response) => this.handlePaymentStatus(response, component))
          .catch((error) => {
            this.displayError(error.response?.data?.message);
          });
      },
      paymentMethodsConfiguration: {
        threeDS2: {
          challengeWindowSize: '05',
        },
      },
    };
    const checkout = await AdyenCheckout(configuration);
    const config = {
      amazonCheckoutSessionId,
      showOrderButton: false,
    };
    const amazonPayComponent = checkout
      .create('amazonpay', config)
      .mount('#amazonpay_order-container');

    window.amazonPayComponent = amazonPayComponent;
    amazonPayComponent.submit();
  },
  methods: {
    ...mapActions(useAdyenStore, ['getInitialConfigValues', 'getPaymentMethodsResponse']),

    setOrderId(orderId) {
      this.orderId = orderId;
      return orderId;
    },

    async handleAdditionalDetails(state, component) {
      try {
        this.state = 'loading';
        document.body.classList.remove('gene-checkout-threeds-opened');
        const request = state.data ? state.data : {};
        request.orderId = this.orderId;
        const response = await getAdyenPaymentDetails(JSON.stringify(request));
        await this.handlePaymentStatus(response, component);
      } catch (error) {
        // If the getAdyenPaymentDetails call errors we need to catch it.
        const message = error.response?.data?.message;
        this.displayError(message);
      }
    },

    getPaymentMethod(state) {
      const additionalDataKey = this.isAdyenVersion('9') ? 'adyen_additional_data' : 'adyen_additional_data_hpp';

      return {
        code: this.isAdyenVersion('9') ? 'adyen_amazonpay' : 'adyen_hpp',
        [additionalDataKey]: {
          brand_code: state.data.paymentMethod.type,
          stateData: JSON.stringify(state.data),
        },
      };
    },

    async handlePaymentStatus(response, component) {
      if (response.isFinal) {
        const approvedCodes = [
          'Authorised',
          'Received',
          'PresentToShopper',
        ];
        if (approvedCodes.includes(response.resultCode)) {
          const [
            getCartSectionNames,
            refreshCustomerData,
          ] = await loadFromCheckout([
            'helpers.getCartSectionNames',
            'services.refreshCustomerData',
          ]);

          this.state = 'success';
          // Refresh the customers cart to clear any previous quote information before redirecting to success.
          await refreshCustomerData(getCartSectionNames());
          setTimeout(() => this.redirectToSuccess(), 3000);
        } else {
          this.displayError(response.message);
        }
      } else if (response.action) {
        // If the action is 3DS related then add a class globally so we can display as popup.
        if (response.action.type === 'threeDS2') {
          document.body.classList.add('gene-checkout-threeds-opened');
        }

        component.handleAction(response.action);
      }
    },

    async redirectToSuccess() {
      const [
        getSuccessPageUrl,
      ] = await loadFromCheckout([
        'helpers.getSuccessPageUrl',
      ]);

      window.location.href = getSuccessPageUrl();
    },

    // Display an error inside of the drop in component.
    displayError(message = this.$t('errorMessages.unexpectedPaymentError')) {
      this.state = 'error';
      this.errorMessage = message;

      // Reset the drop in component back to ready after 3 seconds.
      setTimeout(async () => {
        const [
          stepsStore,
        ] = await loadFromCheckout([
          'stores.useStepsStore',
        ]);

        // Redirect to the main payment page after displaying the error to allow the User to try a different method.
        stepsStore.goToPayment();
        window.history.replaceState({}, '', '/checkout/#/payments');
      }, 3000);
    },
  },
};
</script>

<style lang="scss" scoped>
@import "./AmazonReviewStyles";
</style>
