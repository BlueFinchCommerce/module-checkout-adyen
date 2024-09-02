<template>
  <div>
    <component
      :is="AdyenPaymentMethods"
      id="adyen-dropin-container-stored"
      :key="`adyenPayments-${adyenKey}`"
      :stored-payments="true"
    />
  </div>
</template>

<script>

// Components
import AdyenPaymentMethods from './PaymentMethods/PaymentMethods.vue';

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
  },
};
</script>

<style lang="scss">
@import "./DropInStyles.scss";
</style>
