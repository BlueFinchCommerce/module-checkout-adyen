[![CircleCI](https://dl.circleci.com/status-badge/img/gh/BlueFinchCommerce/module-checkout-adyen/tree/main.svg?style=svg)](https://dl.circleci.com/status-badge/redirect/gh/BlueFinchCommerce/module-checkout-adyen/tree/main)

[![GNU General Public License Version 3](./assets/license-GPLv3.svg)](https://github.com/BlueFinchCommerce/module-checkout-adyen/?tab=GPL-3.0-1-ov-file#readme)

![Checkout Powered by BlueFinch](./assets/logo.svg)

# BlueFinch Checkout Adyen Module

## Requirements

- Magento 2.4.6 or higher
- Node 16 or higher (for development purposes only)
- Latest version of BlueFinch Checkout

## Installation

Ensure you have installed the latest version of BlueFinch Checkout, which can be found here, [BlueFinch Checkout](https://github.com/bluefinchcommerce/module-checkout).

To install the Checkout Adyen module, run the following command in your Magento 2 root directory:

``` composer require bluefinch/module-checkout-adyen ```

Checkout Adyen follows the standard installation process for Adobe Commerce.

For information about a module installation in Adobe Commerce, see [Enable or disable modules](https://experienceleague.adobe.com/en/docs/commerce-operations/installation-guide/tutorials/manage-modules).

Remember to clear any appropriate caches.

Once installed the module follows the same configuration settings as prescribed by the official Adyen integration documentation, see [Adyen for Magento](https://docs.adyen.com/plugins/adobe-commerce/).


## Local frontend development workflow

Please refer to the local frontend development workflow section of the [BlueFinch Checkout contributing guidelines](https://github.com/BlueFinchCommerce/module-checkout/blob/main/.github/CONTRIBUTING.md), that applies to all BlueFinch Checkout extension modules, such as this one.

## CircleCi

CircleCi is a tool for us to use to allow for tested to be run on our modules before they are deployed.

This template comes with EsLint and PHPStan.

You can add more tests to this if you need to.


### Testing your module locally

You can test CircleCi before you push your code.

To do this you need to install circleci locally.

``` brew install circleci```

Then once this has been installed in the main directory of your package then.

```circleci local execute```
