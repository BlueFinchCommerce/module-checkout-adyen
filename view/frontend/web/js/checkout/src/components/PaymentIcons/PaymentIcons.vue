<template>
  <template v-if="isAdyenAvailable">
    <div class="adyen-payment-icons">
      <ul
        class="pay-with__column"
        v-if="Object.keys(paymentTypes).length > 0">
        <template v-for="(paymentType, index) in paymentTypes">
          <li
            v-if="paymentType.icon && !paymentType.icon.includes('klarna_account')"
            :key="index"
            class="pay-with__content"
          >
            <img
              :src="paymentType.icon"
              :alt="paymentType.name"
              :class="generateClass(paymentType.name)"
              :data-cy="generateDataCY(paymentType.icon, 'adyen')"
            >
          </li>
        </template>
      </ul>
    </div>
  </template>
</template>

<script>
import { mapActions, mapState } from 'pinia';
import useAdyenStore from '../../stores/PaymentStores/AdyenStore';

// Icons
import ApplePaySvg from '../../icons/payments/white/icon-applepay-white.svg';
import GooglePaySvg from '../../icons/payments/white/icon-googlepay-white.svg';
import ExpressPaySvg from '../../icons/payments/white/icon-amex-white.svg';
import PayPalSvg from '../../icons/payments/white/icon-paypal-white.svg';
import KlarnaSvg from '../../icons/payments/white/icon-klarna-white.svg';
import MaestroPaySvg from '../../icons/payments/white/icon-maestro-white.svg';
import MastercardPaySvg from '../../icons/payments/white/icon-mastercard-white.svg';
import VisaPaySvg from '../../icons/payments/white/icon-visa-white.svg';
import ClearpaySvg from '../../icons/payments/white/icon-clearpay-white.svg';

// Components
import loadFromCheckout from '../../helpers/loadFromCheckout';

export default {
  name: 'PaymentIcons',
  data() {
    return {
      adyenKey: 0,
      AdyenPaymentMethods: null,
      ApplePayIcon: null,
      GooglePayIcon: null,
      ExpressPayIcon: null,
      PayPalIcon: null,
      KlarnaIcon: null,
      MaestroPayIcon: null,
      MastercardPayIcon: null,
      VisaPayIcon: null,
      ClearpayIcon: null,
      VenmoPayIcon: null,
    };
  },
  computed: {
    ...mapState(useAdyenStore, ['isAdyenAvailable', 'adyenVaultEnabled', 'getAdyenClientKey', 'paymentTypes']),
  },
  async created() {
    await this.getInitialConfigValues();

    const [
      getStaticPath,
    ] = await loadFromCheckout([
      'helpers.getStaticPath',
    ]);

    this.ApplePayIcon = getStaticPath(ApplePaySvg);
    this.GooglePayIcon = getStaticPath(GooglePaySvg);
    this.ExpressPayIcon = getStaticPath(ExpressPaySvg);
    this.PayPalIcon = getStaticPath(PayPalSvg);
    this.KlarnaIcon = getStaticPath(KlarnaSvg);
    this.MaestroPayIcon = getStaticPath(MaestroPaySvg);
    this.MastercardPayIcon = getStaticPath(MastercardPaySvg);
    this.VisaPayIcon = getStaticPath(VisaPaySvg);
    this.ClearpayIcon = getStaticPath(ClearpaySvg);
  },
  methods: {
    ...mapActions(useAdyenStore, [
      'getInitialConfigValues',
    ]),

    generateClass(paymentName) {
      // Convert paymentType.name to lowercase and replace spaces with underscores
      return paymentName.toLowerCase().replace(/\s+/g, '_');
    },

    generateDataCY(paymentIconName, serviceProvider) {
      let iconName = paymentIconName;

      if (serviceProvider === 'adyen') {
        // Extract the string after "logos/" and before ".svg" or ".png" using a regular expression
        const match = paymentIconName.match(/\/logos\/(.*?)\.(svg|png)/);
        if (match) {
          [, iconName] = match;
        }
      }

      return `adyen-${serviceProvider}-${iconName}-icon`;
    },
  },
};
</script>

<style lang="scss">
@import "./PaymentIconsStyles";
</style>
