<?php

namespace HiEvents\Services\Infrastructure\WebPage;

use GuzzleHttp\Client;
use GuzzleHttp\Exception\ConnectException;
use GuzzleHttp\Exception\GuzzleException;
use GuzzleHttp\Psr7\UriResolver;
use GuzzleHttp\Psr7\Utils;

/**
 * Lit une page ou une image a une adresse donnee par un organisateur, sans
 * jamais atteindre le reseau interne : seules les adresses publiques sont
 * permises (ni localhost, ni 10/8, 192.168/16, 169.254/16, ni 100.64/10 de
 * Tailscale), l'adresse IP verifiee est celle qui est contactee (pas de
 * second DNS), et chaque redirection est reverifiee. Taille et duree bornees.
 * Si l'adresse IPv4 ne repond pas, l'IPv6 est essayee (et l'inverse).
 */
class SafeWebFetcher
{
    private const MAX_REDIRECTS = 4;

    private const CONNECT_TIMEOUT = 4;

    private const TIMEOUT = 10;

    private const USER_AGENT = 'Mozilla/5.0 (compatible; BilletterieDehors/1.0; +https://billets.dehorsqc.com)';

    /**
     * Instagram renvoie l'IPv4 du serveur (une adresse de centre de donnees) vers sa
     * page de connexion, mais montre le compte a son IPv6 : l'IPv6 passe d'abord.
     */
    private const IPV6_FIRST = '/(^|\.)(instagram\.com|cdninstagram\.com)$/i';

    /**
     * @param bool $truncate une page trop longue est coupee (son debut suffit) ; une image trop lourde est refusee
     * @throws UnsafeUrlException
     * @throws WebPageFetchException
     */
    public function fetch(string $url, int $maxBytes, bool $truncate = false): FetchedWebPage
    {
        $current = $this->normalize($url);

        for ($redirects = 0; $redirects <= self::MAX_REDIRECTS; $redirects++) {
            $parts = parse_url($current);
            $host = $parts['host'];
            $port = (int)($parts['port'] ?? ($parts['scheme'] === 'https' ? 443 : 80));
            $response = null;
            $failure = null;
            foreach ($this->addressesToTry($host) as $ip) {
                try {
                    $response = (new Client())->request('GET', $current, [
                        'allow_redirects' => false,
                        'http_errors' => false,
                        'stream' => true,
                        'connect_timeout' => self::CONNECT_TIMEOUT,
                        'timeout' => self::TIMEOUT,
                        'headers' => [
                            'User-Agent' => self::USER_AGENT,
                            'Accept-Language' => 'fr-CA,fr;q=0.9,en;q=0.6',
                            'Accept' => 'text/html,application/xhtml+xml,image/avif,image/webp,image/*;q=0.9,*/*;q=0.5',
                        ],
                        // La connexion va a l'adresse verifiee, pas a un nouveau DNS.
                        'curl' => [CURLOPT_RESOLVE => [sprintf('%s:%d:%s', $host, $port, str_contains($ip, ':') ? "[$ip]" : $ip)]],
                    ]);
                    break;
                } catch (ConnectException $exception) {
                    // Pas de route vers cette adresse (souvent l'IPv6) : l'autre famille.
                    $failure = $exception;
                } catch (GuzzleException $exception) {
                    throw new WebPageFetchException(__('The address could not be reached.'), previous: $exception);
                }
            }
            if ($response === null) {
                throw new WebPageFetchException(__('The address could not be reached.'), previous: $failure);
            }

            $status = $response->getStatusCode();
            if ($status >= 300 && $status < 400 && $response->hasHeader('Location')) {
                $current = $this->normalize((string)UriResolver::resolve(Utils::uriFor($current), Utils::uriFor($response->getHeaderLine('Location'))));
                continue;
            }

            if ($status >= 400) {
                throw new WebPageFetchException(__('The address answered with an error (:status).', ['status' => $status]));
            }

            $body = $response->getBody();
            $content = '';
            while (!$body->eof()) {
                $content .= $body->read(65536);
                if (strlen($content) > $maxBytes) {
                    if (!$truncate) {
                        throw new WebPageFetchException(__('The file is too large.'));
                    }
                    $content = substr($content, 0, $maxBytes);
                    break;
                }
            }
            $body->close();

            return new FetchedWebPage(
                url: $current,
                contentType: strtolower(trim(explode(';', $response->getHeaderLine('Content-Type'))[0])),
                charset: $this->charset($response->getHeaderLine('Content-Type')),
                body: $content,
            );
        }

        throw new WebPageFetchException(__('Too many redirects.'));
    }

    /**
     * Une adresse web complete (https:// ajoute au besoin), sans identifiants ni port inhabituel.
     *
     * @throws UnsafeUrlException
     */
    public function normalize(string $url): string
    {
        $url = trim($url);
        if (preg_match('#^[a-z][a-z0-9+.\-]*:#i', $url) && !preg_match('#^https?://#i', $url) && !preg_match('#^[^/:]+:\d+(/|$)#', $url)) {
            throw new UnsafeUrlException(__('This is not a valid web address.'));
        }
        if (!preg_match('#^https?://#i', $url)) {
            $url = 'https://' . ltrim($url, '/');
        }

        $parts = parse_url($url);
        if ($parts === false || empty($parts['host']) || !in_array(strtolower($parts['scheme'] ?? ''), ['http', 'https'], true)) {
            throw new UnsafeUrlException(__('This is not a valid web address.'));
        }
        if (isset($parts['user']) || isset($parts['pass'])) {
            throw new UnsafeUrlException(__('This is not a valid web address.'));
        }
        if (isset($parts['port']) && !in_array((int)$parts['port'], [80, 443], true)) {
            throw new UnsafeUrlException(__('This address cannot be read.'));
        }

        return $url;
    }

    /**
     * L'adresse IP publique a contacter ; refusee si le nom mene, meme en partie, au reseau interne.
     *
     * @throws UnsafeUrlException
     */
    public function publicAddress(string $host): string
    {
        return $this->publicAddresses($host)[0];
    }

    /**
     * La premiere adresse de chaque famille, toutes verifiees : IPv4 d'abord, sauf pour IPV6_FIRST.
     *
     * @return list<string>
     * @throws UnsafeUrlException
     */
    public function addressesToTry(string $host): array
    {
        $addresses = $this->publicAddresses($host);
        $v4 = array_values(array_filter($addresses, fn(string $ip) => !str_contains($ip, ':')));
        $v6 = array_values(array_filter($addresses, fn(string $ip) => str_contains($ip, ':')));
        $order = preg_match(self::IPV6_FIRST, trim($host, '[]')) ? [$v6, $v4] : [$v4, $v6];

        return array_values(array_filter([$order[0][0] ?? null, $order[1][0] ?? null]));
    }

    /**
     * @return non-empty-list<string>
     * @throws UnsafeUrlException
     */
    private function publicAddresses(string $host): array
    {
        $host = trim($host, '[]');
        $addresses = filter_var($host, FILTER_VALIDATE_IP) ? [$host] : $this->resolve($host);

        if ($addresses === []) {
            throw new UnsafeUrlException(__('This address does not exist.'));
        }

        foreach ($addresses as $address) {
            if (!$this->isPublic($address)) {
                throw new UnsafeUrlException(__('This address cannot be read.'));
            }
        }

        return $addresses;
    }

    public function isPublic(string $ip): bool
    {
        if (!filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE | FILTER_FLAG_GLOBAL_RANGE)) {
            return false;
        }

        // 100.64.0.0/10 : le reseau partage des operateurs, et de Tailscale.
        if (filter_var($ip, FILTER_VALIDATE_IP, FILTER_FLAG_IPV4)) {
            $long = ip2long($ip);

            return !($long >= ip2long('100.64.0.0') && $long <= ip2long('100.127.255.255'));
        }

        return true;
    }

    /** @return list<string> IPv4 d'abord */
    private function resolve(string $host): array
    {
        $v4 = gethostbynamel($host) ?: [];
        $v6 = array_column(@dns_get_record($host, DNS_AAAA) ?: [], 'ipv6');

        return array_values(array_unique([...$v4, ...$v6]));
    }

    private function charset(string $contentType): ?string
    {
        return preg_match('/charset=["\']?([\w-]+)/i', $contentType, $match) ? strtolower($match[1]) : null;
    }
}
