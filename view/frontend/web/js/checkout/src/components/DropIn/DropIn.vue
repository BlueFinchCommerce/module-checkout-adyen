<template>
  <div>
    <component
      :is="AdyenPaymentMethods"
      id="adyen-dropin-container-new"
      :key="`adyenPayments-${adyenKey}`"
    />
  </div>
</template>

<script>

// Components
import AdyenPaymentMethods from './PaymentMethods/PaymentMethods.vue';

import loadFromCheckout from '../../helpers/loadFromCheckout';

export default {
  name: 'AdyenDropIn',
  data() {
    return {
      adyenKey: 0,
      AdyenPaymentMethods: null,
    };
  },
  async created() {
    this.AdyenPaymentMethods = AdyenPaymentMethods;
    const [
      cartStore,
      gtmStore,
    ] = await loadFromCheckout([
      'stores.useConfigStore',
      'stores.useGtmStore',
    ]);

    await cartStore.getInitialConfig();

    gtmStore.trackGtmEvent({
      event: 'checkoutOption',
      ecommerce: {
        checkout_option: {
          actionField: {
            step: 3,
            option: 'payment',
          },
        },
      },
    });
  },
};
</script>

<style lang="scss">
@import "./DropInStyles.scss";
</style>
