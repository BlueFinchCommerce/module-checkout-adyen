<template>
  <template v-if="!storedPayments || storedPaymentMethods.length > 0">
    <teleport
      v-if="agreementLocation !== ''"
      :to="agreementLocation"
    >
      <component :is="Agreements" :id="`adyenDropIn-${storedPayments ? 'stored' : 'new'}`" />
      <component :is="PrivacyPolicy" />
      <component
        :is="Recaptcha"
        v-if="isRecaptchaVisible"
        id="placeOrder"
        :location="`adyenDropIn${storedPayments ? 'stored' : 'new'}`"
      />
    </teleport>
    <teleport
      v-if="storedPayments && storedPaymentCardsLocation !== ''"
      :to="storedPaymentCardsLocation"
    >
      <component
        :is="AdyenPaymentCard"
        v-for="storedPaymentMethod in storedPaymentMethods"
        v-show="!isErrorDisplayed && paymentVisible"
        :class="{ 'adyen-stored-payment-selected': storedPaymentSelected }"
        :key="storedPaymentMethod.id"
        :method="storedPaymentMethod"
      />
    </teleport>
    <div
      v-show="!isErrorDisplayed && paymentVisible"
      :id="id"
      :data-cy="id"
    />
  </template>
</template>

<script>
// stores
import { mapActions, mapState } from 'pinia';
import AdyenCheckout from '@adyen/adyen-web';
import useAdyenStore from '../../../stores/PaymentStores/AdyenStore';

import '@adyen/adyen-web/dist/adyen.css';

// Components
import AdyenPaymentCard from '../PaymentCard/PaymentCard.vue';

// Services
import getAdyenPaymentStatus from '../../../services/getAdyenPaymentStatus';
import getAdyenPaymentDetails from '../../../services/getAdyenPaymentDetails';

import getAdyenProductionMode from '../../../helpers/getAdyenProductionMode';
import loadFromCheckout from '../../../helpers/loadFromCheckout';

export default {
  name: 'AdyenPaymentMethods',
  props: {
    id: {
      type: String,
      default: 'adyen-dropin-container',
    },
    storedPayments: {
      type: Boolean,
      default: false,
    },
  },
  emits: ['adyenPaymentSelected'],
  data() {
    return {
      agreementLocation: '',
      storedPaymentCardsLocation: '',
      orderId: null,
      storedPaymentMethods: [],
      storedPaymentSelected: false,
      selectedOriginalId: null,
      paymentMethodTitles: null,
      methodSelectedClass: 'adyen-checkout__payment-method--selected',
      isErrorDisplayed: false,
      hideStoredPaymentRadio: false,
      paymentLoading: false,
      paymentVisible: true,
      isRecaptchaVisible: false,
      Agreements: null,
      PrivacyPolicy: null,
      Recaptcha: null,
      selectedMethod: null,
      AdyenPaymentCard: null,
    };
  },
  computed: {
    ...mapState(useAdyenStore, ['adyenVaultEnabled', 'getAdyenClientKey', 'isAdyenVersion', 'recurringConfiguration']),
  },
  async created() {
    const [
      Agreements,
      PrivacyPolicy,
      Recaptcha,
      getPaymentExtensionAttributes,
      createPaymentGraphQl,
      agreementStore,
      cartStore,
      configStore,
      customerStore,
      paymentStore,
      recaptchaStore,
    ] = await loadFromCheckout([
      'components.Agreements',
      'components.PrivacyPolicy',
      'components.Recaptcha',
      'helpers.getPaymentExtensionAttributes',
      'services.createPaymentGraphQl',
      'stores.useAgreementStore',
      'stores.useCartStore',
      'stores.useConfigStore',
      'stores.useCustomerStore',
      'stores.usePaymentStore',
      'stores.useRecaptchaStore',
    ]);

    await configStore.getInitialConfig();
    await this.getInitialConfigValues();
    await cartStore.getCart();

    this.AdyenPaymentCard = AdyenPaymentCard;

    this.Agreements = Agreements;
    this.PrivacyPolicy = PrivacyPolicy;
    this.Recaptcha = Recaptcha;
    this.isRecaptchaVisible = recaptchaStore.isRecaptchaVisible('placeOrder');
    this.selectedMethod = paymentStore.selectedMethod;

    const paymentMethodsResponse = await this.getPaymentMethodsResponse();

    this.storedPaymentMethods = this.getFilteredStoredMethods(paymentMethodsResponse);

    // If we are on a stored payment component but have no stored payments
    // available then we can return early.
    if (this.storedPayments && !this.storedPaymentMethods.length) {
      return;
    }

    paymentStore.$subscribe((mutation) => {
      if (mutation?.payload?.selectedMethod) {
        if (mutation.payload.selectedMethod !== null && this.checkout !== undefined) {
          // Only do this for example if a stored payment is selected and new card is open.
          if (this.id !== mutation.payload.selectedMethod && this.checkout.dropinRef) {
            this.checkout.dropinRef.closeActivePaymentMethod();
          }

          // Set the stored payment radio field state depending on if it matches
          // the current ID.
          this.storedPaymentSelected = this.id === mutation.payload.selectedMethod;

          // If the selected method isn't a stored method then reset all stored method selection.
          if (mutation.payload.selectedMethod !== 'adyen-dropin-container-stored') {
            this.storedPaymentMethods = this.storedPaymentMethods.map((storedMethod) => {
              const updatedMethod = storedMethod;
              updatedMethod.default = false;
              return updatedMethod;
            });
          }
        }
      }
    });

    this.storedPaymentSelected = true;

    const extensionAttributes = getPaymentExtensionAttributes();
    const configuration = {
      paymentMethodsResponse,
      clientKey: await this.getAdyenClientKey,
      locale: configStore.locale,
      environment: getAdyenProductionMode() ? 'live' : 'test',
      analytics: {
        enabled: false,
      },
      amount: {
        value: cartStore.cartGrandTotal,
        currency: configStore.currencyCode,
      },
      showPaymentMethods: !this.storedPayments,
      onAdditionalDetails: this.handleAdditionalDetails.bind(this),
      onError: this.handleOnError.bind(this),
      onSubmit: (state, dropin) => {
        // Check that the agreements (if any) and recpatcha is valid.
        const agreementsValid = agreementStore.validateAgreements();
        const recaptchaValid = recaptchaStore.validateToken('placeOrder');
        state.isValid = agreementsValid && recaptchaValid;

        if (state.isValid) {
          const paymentMethod = this.getPaymentMethod(state, extensionAttributes);

          paymentStore.paymentEmitter.emit('adyenPaymentLoading', { id: this.id, loading: true });
          paymentStore.paymentEmitter.emit('paymentProcessing', true);

          createPaymentGraphQl(paymentMethod)
            .then(this.setOrderId)
            .then(getAdyenPaymentStatus)
            .then((response) => this.handlePaymentStatus(response, dropin))
            .catch((error) => {
              this.displayError(dropin, error.message).bind(this);
              throw Error(error);
            });
        } else {
          dropin.setStatus('ready');
        }
      },
      paymentMethodsConfiguration: {
        card: {
          hasHolderName: false,
          holderNameRequired: false,
          enableStoreDetails: customerStore.isLoggedIn && (this.isAdyenVersion('9')
            ? this.recurringConfiguration?.adyen_cc?.enabled === '1'
            : this.adyenVaultEnabled),
          hideCVC: false,
          name: 'Credit or debit card',
        },
        threeDS2: {
          challengeWindowSize: '05',
        },
      },
    };

    const adyenCheckout = await AdyenCheckout(configuration);
    this.checkout = adyenCheckout
      .create('dropin', {
        showStoredPaymentMethods: this.storedPayments,
        showPaymentMethods: !this.storedPayments,
        openFirstPaymentMethod: !this.storedPaymentMethods.length,
        openFirstStoredPaymentMethod: this.storedPaymentMethods.length,
        setStatusAutomatically: false,
        onSelect: this.onSelect,
      });
    this.checkout.mount(`#${this.id}`);

    // If we are on the stored payments compent (and some stored payments exist) then
    // modify the methods to show the payment cards rather that input radios.
    if (this.storedPayments && this.storedPaymentMethods.length) {
      // Created a mutation observer to handle when the drop in component is actually ready
      // because Adyen doesn't provide a useful callback to trigger this.
      const target = document.getElementById('adyen-dropin-container-new');

      if (target.querySelector('.adyen-checkout__dropin--ready')) {
        this.modifyStoredPayments();
      } else {
        const config = { childList: true, subtree: true };
        const callback = (mutationList, observer) => {
          // Check that the newly added element has the class 'ready' on it and when it does trigger the modifications
          // and disconnect the observer.
          const isReady = mutationList.some((mutation) => (
            mutation.target.classList.contains('adyen-checkout__dropin--ready')
          ));
          if (isReady) {
            this.modifyStoredPayments();
            observer.disconnect();
          }
        };
        const observer = new MutationObserver(callback);
        observer.observe(target, config);
      }
    }

    // If an error is displaying we can hide the payment methods.
    paymentStore.paymentEmitter.on('adyenPaymentDisplayingError', ({ id, isDisplaying }) => {
      if (this.id !== id) {
        this.isErrorDisplayed = isDisplaying;
      }
      this.hideStoredPaymentRadio = isDisplaying;
    });

    paymentStore.paymentEmitter.on('paymentProcessing', (processing) => {
      processing ? this.checkout.setStatus('loading') : this.checkout.setStatus('ready');
    });

    paymentStore.paymentEmitter.on('adyenPaymentLoading', ({ id, loading }) => {
      if (this.id !== id) {
        loading ? this.checkout.setStatus('loading') : this.checkout.setStatus('ready');
        this.paymentLoading = loading;
      }
    });

    paymentStore.paymentEmitter.on('adyenStoredPaymentCardSelected', ({ originalId }) => {
      // Update the selected method.
      this.storedPaymentMethods = this.storedPaymentMethods.map((storedMethod) => {
        const updatedMethod = storedMethod;
        updatedMethod.default = originalId === storedMethod.originalId;
        return updatedMethod;
      });

      if (originalId) {
        const originalButton = document.getElementById(originalId);
        originalButton.click();
        this.selectedOriginalId = originalId;
      }
    });

    paymentStore.paymentEmitter.on('paymentMethodSelected', ({ type }) => {
      if (!type.includes('adyen')) {
        this.checkout.dropinRef.closeActivePaymentMethod();
      }
    });
  },
  async beforeUnmount() {
    const [
      paymentStore,
    ] = await loadFromCheckout([
      'stores.usePaymentStore',
    ]);

    if (this.checkout) {
      paymentStore.paymentEmitter.all.clear();
      this.checkout.unmount();
      this.clearPaymentReponseCache();
    }
  },
  methods: {
    ...mapActions(useAdyenStore, [
      'getInitialConfigValues',
      'getPaymentMethodsResponse',
      'clearPaymentReponseCache',
    ]),

    setOrderId(orderId) {
      this.orderId = orderId;
      return orderId;
    },

    getFilteredStoredMethods(paymentMethodsResponse) {
      if (!paymentMethodsResponse.storedPaymentMethods) {
        return [];
      }

      return paymentMethodsResponse.storedPaymentMethods.filter((storedMethod) => (
        storedMethod.supportedShopperInteractions.includes('Ecommerce')
      ));
    },

    getPaymentMethod(state) {
      const paymentMethod = {};

      if (state.data.paymentMethod.type === 'scheme') {
        paymentMethod.code = 'adyen_cc';
      } else if (this.isAdyenVersion('9')) {
        paymentMethod.code = `adyen_${state.data.paymentMethod.type}`;
      } else {
        paymentMethod.code = 'adyen_hpp';
      }

      if (state.data?.paymentMethod?.storedPaymentMethodId) {
        state.data.storePaymentMethod = true;
      }

      const stateData = JSON.stringify(state.data);

      if (paymentMethod.code === 'adyen_cc') {
        paymentMethod.adyen_additional_data_cc = {
          cc_type: state.data.paymentMethod.brand,
          stateData,
          recurringProcessingModel: this.isAdyenVersion('9')
            ? this.recurringConfiguration?.adyen_cc?.recurringProcessingModel
            : 'CardOnFile',
          is_active_payment_token_enabler: !!state.data.storePaymentMethod,
        };
      } else {
        const additionalDataKey = this.isAdyenVersion('9') ? 'adyen_additional_data' : 'adyen_additional_data_hpp';
        paymentMethod[additionalDataKey] = {
          brand_code: state.data.paymentMethod.type,
          stateData,
        };
      }

      return paymentMethod;
    },

    async handlePaymentStatus(response, dropin) {
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

          dropin.setStatus('success');
          // Refresh the customers cart to clear any previous quote information before redirecting to success.
          await refreshCustomerData(getCartSectionNames());
          setTimeout(() => this.redirectToSuccess(), 3000);
        } else {
          this.displayError(dropin, response.message);
        }
      } else if (response.action) {
        // If the action is 3DS related then add a class globally so we can display as popup.
        if (response.action.type === 'threeDS2') {
          document.body.classList.add('gene-checkout-threeds-opened');
        }

        dropin.handleAction(response.action);
      }
    },

    async handleAdditionalDetails(state, dropin) {
      try {
        dropin.setStatus('loading');
        document.body.classList.remove('gene-checkout-threeds-opened');
        const request = state.data ? state.data : {};
        request.orderId = this.orderId;
        const response = await getAdyenPaymentDetails(JSON.stringify(request));
        await this.handlePaymentStatus(response, dropin);
      } catch (error) {
        // If the getAdyenPaymentDetails call errors we need to catch it.
        const message = error.response?.data?.message;
        this.displayError(dropin, message);
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

    handleOnError(state, dropin) {
      // On 'CANCEL' we need to handle it and send request to cancel the payment against the order.
      if (state.name === 'CANCEL') {
        const request = {
          orderId: this.orderId,
          cancelled: true,
        };
        this.handleOnCancel(request, dropin);
      } else {
        this.displayError(dropin);
      }
    },
    async handleOnCancel(request, dropin) {
      try {
        await getAdyenPaymentDetails(JSON.stringify(request));
      } catch (error) {
        this.displayError(dropin, error.response?.data?.message);
      }
    },

    // Display an error inside of the drop in component.
    async displayError(dropin, message = this.$t('errorMessages.unexpectedPaymentError')) {
      const [
        paymentStore,
      ] = await loadFromCheckout([
        'stores.usePaymentStore',
      ]);

      paymentStore.paymentEmitter.emit('adyenPaymentDisplayingError', { id: this.id, isDisplaying: true });
      paymentStore.paymentEmitter.emit('paymentProcessing', false);
      dropin && dropin.setStatus('error', {
        message,
      });

      // Reset the drop in component back to ready after 3 seconds.
      setTimeout(() => {
        dropin && dropin.setStatus('ready');
        paymentStore.paymentEmitter.emit('adyenPaymentDisplayingError', { id: this.id, isDisplaying: false });
        paymentStore.paymentEmitter.emit('adyenPaymentLoading', { id: this.id, loading: false });

        // If we are on the stored payments compent (and some stored payments exist) then
        // modify the methods to show the payment cards rather that input radios.
        if (this.storedPayments && this.storedPaymentMethods.length) {
          setTimeout(() => this.modifyStoredPayments(), 0);
        }

        this.updateAgreementLocation();
      }, 3000);
    },

    async onSelect(config) {
      const [
        paymentStore,
      ] = await loadFromCheckout([
        'stores.usePaymentStore',
      ]);

      // Emit event on RVVUP selected
      paymentStore.paymentEmitter.emit('paymentMethodSelected', { type: `adyen_${config.props.type}` });

      paymentStore.selectPaymentMethod(this.id);
      setTimeout(this.updateAgreementLocation, 0);
    },

    updateAgreementLocation() {
      this.agreementLocation = '';
      setTimeout(() => {
        this.agreementLocation = `.${this.methodSelectedClass}
            .adyen-checkout__payment-method__details`;
      }, 0);
    },

    async modifyStoredPayments() {
      const [
        paymentStore,
      ] = await loadFromCheckout([
        'stores.usePaymentStore',
      ]);

      setTimeout(() => {
        // Reset the placement of the stored payment cards before working on them.
        setTimeout(() => { this.storedPaymentCardsLocation = ''; }, 0);

        const paymentContainer = `#${this.id} .adyen-checkout__payment-methods-list`;
        const storedPayments = document.querySelector(paymentContainer);
        const paymentMethods = this.paymentMethodTitles || storedPayments
          .querySelectorAll('.adyen-checkout__payment-method__header__title');

        this.createStyledList(storedPayments, paymentMethods.length);

        this.storedPaymentMethods = this.storedPaymentMethods.map((method, index) => {
          const updatedMethod = method;
          updatedMethod.originalId = paymentMethods[index].id;
          return updatedMethod;
        });

        // If there isn't a method selected then set the first to default.
        const hasSelected = this.storedPaymentMethods.find(({ originalId }) => (
          originalId === this.selectedOriginalId
        ));

        if (!hasSelected) {
          this.storedPaymentMethods[0].default = true;
          this.selectedOriginalId = this.storedPaymentMethods[0].originalId;
        }

        this.storedPaymentMethods.forEach((method) => {
          if (method.default) {
            paymentStore.paymentEmitter.emit(
              'adyenStoredPaymentCardSelected',
              { originalId: this.selectedOriginalId },
            );
          }
        });
      }, 0);
    },

    createStyledList(storedPayments, paymentMethodCount) {
      const styledList = document.createElement('div');
      styledList.classList.add('adyen-checkout__payment-methods-list-styled');
      styledList.classList.add(`adyen-checkout__payment-methods-list-styled-${paymentMethodCount}`);
      storedPayments.before(styledList);

      // Move the stored payments cards to the correct place.
      setTimeout(() => {
        this.storedPaymentCardsLocation = '.adyen-checkout__payment-methods-list-styled';
      }, 0);
    },
  },
};
</script>
<style lang="scss">
@import "./PaymentMethodsStyles.scss";
</style>
