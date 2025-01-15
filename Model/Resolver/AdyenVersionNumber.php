<?php

declare(strict_types=1);

namespace Bluefinch\CheckoutAdyen\Model\Resolver;

use Magento\Framework\Component\ComponentRegistrar;
use Magento\Framework\Component\ComponentRegistrarInterface;
use Magento\Framework\Filesystem\Directory\ReadFactory;
use Magento\Framework\GraphQl\Config\Element\Field;
use Magento\Framework\GraphQl\Query\ResolverInterface;
use Magento\Framework\GraphQl\Schema\Type\ResolveInfo;
use Magento\Framework\Module\Manager;
use Magento\Framework\Serialize\SerializerInterface;

class AdyenVersionNumber implements ResolverInterface
{
    /** @var string */
    public const ADYEN_MODULE_NAME = 'Adyen_Payment';

    /**
     * @param Manager $moduleManager
     * @param ComponentRegistrarInterface $componentRegistrar
     * @param ReadFactory $readFactory
     * @param SerializerInterface $serializer
     */
    public function __construct(
        private readonly Manager $moduleManager,
        private readonly ComponentRegistrarInterface $componentRegistrar,
        private readonly ReadFactory $readFactory,
        private readonly SerializerInterface $serializer
    ) {
    }

    /**
     * @inheritDoc
     */
    public function resolve(Field $field, $context, ResolveInfo $info, array $value = null, array $args = null)
    {
        if ($this->moduleManager->isEnabled(self::ADYEN_MODULE_NAME) === false) {
            return '';
        }

        $path = $this->componentRegistrar->getPath(ComponentRegistrar::MODULE, self::ADYEN_MODULE_NAME);
        $directoryRead = $this->readFactory->create($path);

        if ($directoryRead->isFile('composer.json') === false) {
            return '';
        }

        $data = $this->serializer->unserialize($directoryRead->readFile('composer.json'));
        return $data['version'] ?? '';
    }
}
