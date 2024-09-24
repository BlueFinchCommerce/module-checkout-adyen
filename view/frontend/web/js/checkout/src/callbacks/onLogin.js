import useAdyenStore from '../stores/PaymentStores/AdyenStore';

export default () => {
  const adyenStore = useAdyenStore();
  adyenStore.clearPaymentReponseCache();
  adyenStore.getPaymentMethodsResponse();
};
