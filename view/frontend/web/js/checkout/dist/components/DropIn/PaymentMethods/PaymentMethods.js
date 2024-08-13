import { m as mapState, a as mapActions } from '../../../pinia-D5d2y-Sp.js';
import { r as rN } from '../../../index-BvxV4WF7.js';
import { g as getAdyenProductionMode, u as useAdyenStore } from '../../../AdyenStore-BsnzEvf1.js';
import script$1 from '../PaymentCard/PaymentCard.js';
import { g as getAdyenPaymentStatus, v as vShow } from '../../../getAdyenPaymentStatus-DslOkWAi.js';
import { l as loadFromCheckout } from '../../../loadFromCheckout-CpEUBppu.js';
import { c as createElementBlock, f as createBlock, g as resolveDynamicComponent, e as createCommentVNode, T as Teleport, F as Fragment, h as renderList, w as withDirectives, b as createBaseVNode, o as openBlock, n as normalizeClass, r as resolveComponent } from '../../../runtime-core.esm-bundler-Rf9YpmoW.js';

var getAdyenPaymentDetails = async (payload) => {
  const [
    graphQlRequest,
    cartStore,
  ] = await loadFromCheckout([
    'services.graphQlRequest',
    'stores.useCartStore',
  ]);

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

var script = {
  name: 'AdyenPaymentMethods',

  components: {
    AdyenPaymentCard: script$1,
  },
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
    };
  },
  computed: {
    ...mapState(useAdyenStore, ['adyenVaultEnabled', 'getAdyenClientKey']),
  },
  watch: {
    selectedMethod: {
      handler(newVal) {
        if (newVal !== null && this.checkout !== undefined) {
          // Only do this for example if a stored payment is selected and new card is open.
          if (this.id !== newVal && this.checkout.dropinRef) {
            this.checkout.dropinRef.closeActivePaymentMethod();
          }

          // Set the stored payment radio field state depending on if it matches
          // the current ID.
          this.storedPaymentSelected = this.id === newVal;

          // If the selected method isn't a stored method then reset all stored method selection.
          if (newVal !== 'adyen-dropin-container-stored') {
            this.storedPaymentMethods = this.storedPaymentMethods.map((storedMethod) => {
              const updatedMethod = storedMethod;
              updatedMethod.default = false;
              return updatedMethod;
            });
          }
        }
      },
      immediate: true,
      deep: true,
    },
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

    this.storedPaymentSelected = true;

    console.log(await this.getAdyenClientKey);
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
          enableStoreDetails: customerStore.isLoggedIn && this.adyenVaultEnabled,
          hideCVC: false,
          name: 'Credit or debit card',
        },
        threeDS2: {
          challengeWindowSize: '05',
        },
      },
    };
    console.log('end');

    const adyenCheckout = await rN(configuration);
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

    console.log(this.checkout);
    // If we are on the stored payments compent (and some stored payments exist) then
    // modify the methods to show the payment cards rather that input radios.
    if (this.storedPayments && this.storedPaymentMethods.length) {
      // Created a mutation observer to handle when the drop in component is actually ready
      // because Adyen doesn't provide a useful callback to trigger this.
      const target = document.getElementById('adyen-dropin-container-new');
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

    // If an error is displaying we can hide the payment methods.
    paymentStore.paymentEmitter.on('adyenPaymentDisplayingError', ({ id, isDisplaying }) => {
      if (this.id !== id) {
        this.isErrorDisplayed = isDisplaying;
      }
      this.hideStoredPaymentRadio = isDisplaying;
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
      const paymentMethod = {
        code: state.data.paymentMethod.type === 'scheme' ? 'adyen_cc' : 'adyen_hpp',
      };

      if (state.data?.paymentMethod?.storedPaymentMethodId) {
        state.data.storePaymentMethod = true;
      }

      const stateData = JSON.stringify(state.data);

      if (paymentMethod.code === 'adyen_cc') {
        paymentMethod.adyen_additional_data_cc = {
          cc_type: state.data.paymentMethod.brand,
          stateData,
          recurringProcessingModel: 'CardOnFile',
          is_active_payment_token_enabler: !!state.data.storePaymentMethod,
        };
      } else {
        paymentMethod.adyen_additional_data_hpp = {
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
      dropin.setStatus('error', {
        message,
      });

      // Reset the drop in component back to ready after 3 seconds.
      setTimeout(() => {
        dropin.setStatus('ready');
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

    async onSelect() {
      const [
        paymentStore,
      ] = await loadFromCheckout([
        'stores.usePaymentStore',
      ]);

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

const _hoisted_1 = ["id", "data-cy"];

function render(_ctx, _cache, $props, $setup, $data, $options) {
  const _component_AdyenPaymentCard = resolveComponent("AdyenPaymentCard");

  return (!$props.storedPayments || $data.storedPaymentMethods.length)
    ? (openBlock(), createElementBlock(Fragment, { key: 0 }, [
        ($data.agreementLocation !== '')
          ? (openBlock(), createBlock(Teleport, {
              key: 0,
              to: $data.agreementLocation
            }, [
              (openBlock(), createBlock(resolveDynamicComponent($data.Agreements), {
                id: `adyenDropIn-${$props.storedPayments ? 'stored' : 'new'}`
              }, null, 8 /* PROPS */, ["id"])),
              (openBlock(), createBlock(resolveDynamicComponent($data.PrivacyPolicy))),
              ($data.isRecaptchaVisible)
                ? (openBlock(), createBlock(resolveDynamicComponent($data.Recaptcha), {
                    key: 0,
                    id: "placeOrder",
                    location: `adyenDropIn${$props.storedPayments ? 'stored' : 'new'}`
                  }, null, 8 /* PROPS */, ["location"]))
                : createCommentVNode("v-if", true)
            ], 8 /* PROPS */, ["to"]))
          : createCommentVNode("v-if", true),
        ($props.storedPayments && $data.storedPaymentCardsLocation !== '')
          ? (openBlock(), createBlock(Teleport, {
              key: 1,
              to: $data.storedPaymentCardsLocation
            }, [
              (openBlock(true), createElementBlock(Fragment, null, renderList($data.storedPaymentMethods, (storedPaymentMethod) => {
                return withDirectives((openBlock(), createBlock(_component_AdyenPaymentCard, {
                  class: normalizeClass({'adyen-stored-payment-selected': $data.storedPaymentSelected}),
                  key: storedPaymentMethod.id,
                  method: storedPaymentMethod
                }, null, 8 /* PROPS */, ["class", "method"])), [
                  [vShow, !$data.isErrorDisplayed && $data.paymentVisible]
                ])
              }), 128 /* KEYED_FRAGMENT */))
            ], 8 /* PROPS */, ["to"]))
          : createCommentVNode("v-if", true),
        withDirectives(createBaseVNode("div", {
          id: $props.id,
          "data-cy": $props.id
        }, null, 8 /* PROPS */, _hoisted_1), [
          [vShow, !$data.isErrorDisplayed && $data.paymentVisible]
        ])
      ], 64 /* STABLE_FRAGMENT */))
    : createCommentVNode("v-if", true)
}

script.render = render;
script.__file = "src/components/DropIn/PaymentMethods/PaymentMethods.vue";

export { script as default };
