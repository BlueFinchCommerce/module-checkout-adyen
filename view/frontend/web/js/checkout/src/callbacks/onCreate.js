import AmazonReview from '../components/AmazonReview/AmazonReview.vue';
import useAdyenStore from '../stores/PaymentStores/AdyenStore';
import loadFromCheckout from '../helpers/loadFromCheckout';

export default async () => {
  const { router } = window.geneCheckout;

  router.addRoute({ path: '/adyen-amazon-review', component: AmazonReview });

  const [
    getUrlQuery,
  ] = await loadFromCheckout([
    'helpers.getUrlQuery',
  ]);

  // If we have a Amazon redirect URL then go to that page.
  if (getUrlQuery('amazonCheckoutSessionId')) {
    const adyenStore = useAdyenStore();
    adyenStore.goToAdyenAmazonReview();
  }
};
