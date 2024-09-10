import loadFromCheckout from './loadFromCheckout';

export default async () => {
  const [
    cartStore,
    customerStore,
  ] = await loadFromCheckout([
    'stores.useCartStore',
    'stores.useCustomerStore',
  ]);

  const clearedCart = {
    ...cartStore.cart,
    shipping_addresses: [],
  };

  cartStore.setData({
    cart: clearedCart,
  });

  customerStore.createNewAddress('shipping');
  customerStore.createNewAddress('billing');
};
