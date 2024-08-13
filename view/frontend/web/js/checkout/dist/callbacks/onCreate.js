import { u as useAdyenStore } from '../AdyenStore-BsnzEvf1.js';
import { l as loadFromCheckout } from '../loadFromCheckout-CpEUBppu.js';
import '../pinia-D5d2y-Sp.js';
import '../runtime-core.esm-bundler-Rf9YpmoW.js';

var onCreate = async () => {
  const [
    getUrlQuery,
  ] = await loadFromCheckout([
    'helpers.getUrlQuery',
  ]);

  // If we have a Amazon redirect URL then go to that page.
  if (getUrlQuery('amazonCheckoutSessionId')) {
    const adyenStore = useAdyenStore();
    adyenStore.goToAdyenAmazonReviw();
  }
};

export { onCreate as default };
