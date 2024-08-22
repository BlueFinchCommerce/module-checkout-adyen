<template>
  <button
    class="adyen-checkout__payment-method__header__title button"
    :class="{ 'adyen-checkout__payment-method-disabled': !method.default }"
    :aria-label="$t('paymentCard.storedPaymentLabel', { name: method.name, lastFour: method.lastFour })"
    type="button"
    :data-original-id="method.originalId"
    data-cy="adyen-saved-payment-card-button"
    @click="selectPaymentCard"
  >
    <component
      :is="Tick"
      v-if="method.default"
      class="adyen-checkout__payment-method-tick"
      :data-cy="'adyen-saved-payment-card-active-icon'"
    />
    <component
      :is="TextField"
      v-else
      class="adyen-checkout__payment-method-select"
      :text="$t('paymentCard.select')"
      :data-cy="'adyen-saved-payment-card-select-text'"
    />
    <span
      class="adyen-checkout__payment-method__radio"
      aria-hidden="true"
    />
    <span
      class="adyen-checkout__payment-method__image__wrapper
        adyen-checkout__payment-method__image__wrapper--outline"
    >
      <img
        class="adyen-checkout__payment-method__image"
        :src="cardLogo"
        :alt="method.name"
        :data-cy="`adyen-saved-payment-card-${method.name}-icon`"
      >
    </span>
    <span
      class="adyen-checkout__payment-method__card-number"
      data-cy="adyen-saved-payment-card-text"
    >
      {{ $t('paymentCard.cardNumber') }}
    </span>
    <span
      class="adyen-checkout__payment-method__name"
      data-cy="adyen-saved-payment-card-text-number"
    >
      **** **** **** {{ method.lastFour }}
    </span>
    <span
      class="adyen-checkout__payment-method__expiry-label"
      data-cy="adyen-saved-payment-card-expiry-text"
    >
      {{ $t('paymentCard.expiry') }}
    </span>
    <span
      class="adyen-checkout__payment-method__expiry"
      data-cy="adyen-saved-payment-card-expiry-date"
    >
      {{ method.expiryMonth }}/{{ method.expiryYear }}
    </span>
  </button>
</template>

<script>
import loadFromCheckout from '../../../helpers/loadFromCheckout';

export default {
  name: 'AdyenPaymentCard',
  props: {
    method: {
      type: Object,
      default: () => {},
    },
  },
  data() {
    return {
      TextField: null,
      Tick: null,
    };
  },
  computed: {
    cardLogo() {
      const { brand } = this.method;
      return `//checkoutshopper-live.adyen.com/checkoutshopper/images/logos/${brand}.svg`;
    },
  },
  async created() {
    const [
      TextField,
      Tick,
    ] = await loadFromCheckout([
      'components.TextField',
      'components.Tick',
    ]);

    this.TextField = TextField;
    this.Tick = Tick;
  },
  methods: {
    async selectPaymentCard() {
      const [
        paymentStore,
      ] = await loadFromCheckout([
        'stores.usePaymentStore',
      ]);

      paymentStore.paymentEmitter.emit('adyenStoredPaymentCardSelected', { originalId: this.method.originalId });
    },
  },
};
</script>

<style lang="scss">
@import "./PaymentCardStyles.scss";
</style>
