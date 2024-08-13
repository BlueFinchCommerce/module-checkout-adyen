import script$1 from './PaymentMethods/PaymentMethods.js';
import { l as loadFromCheckout } from '../../loadFromCheckout-CpEUBppu.js';
import { c as createElementBlock, f as createBlock, g as resolveDynamicComponent, o as openBlock } from '../../runtime-core.esm-bundler-Rf9YpmoW.js';
import '../../pinia-D5d2y-Sp.js';
import '../../index-BvxV4WF7.js';
import '../../AdyenStore-BsnzEvf1.js';
import './PaymentCard/PaymentCard.js';
import '../../getAdyenPaymentStatus-DslOkWAi.js';

var script = {
  name: 'AdyenDropIn',
  data() {
    return {
      adyenKey: 0,
      AdyenPaymentMethods: null,
    };
  },
  async created() {
    this.AdyenPaymentMethods = script$1;
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

function render(_ctx, _cache, $props, $setup, $data, $options) {
  return (openBlock(), createElementBlock("div", null, [
    (openBlock(), createBlock(resolveDynamicComponent($data.AdyenPaymentMethods), {
      id: "adyen-dropin-container-new",
      key: `adyenPayments-${$data.adyenKey}`
    }))
  ]))
}

script.render = render;
script.__file = "src/components/DropIn/DropIn.vue";

export { script as default };
