<?php
/**
 * Plugin Name: Egecelikel Site
 * Description: Serves the hand-written homepage (site/index.html) and JavaScript projects (site/projects/) on egecelikel.com. WordPress keeps running the blog.
 * Version:     1.0.0
 * Author:      Ege Çelikel
 * Requires at least: 6.0
 * Requires PHP: 7.4
 *
 * How it works:
 *   /              -> site/index.html (the WordPress front page is replaced)
 *   /projects/...  -> files under site/projects/ (a folder serves its index.html)
 *   everything else (blog, posts, wp-admin, feeds) -> normal WordPress
 */

defined( 'ABSPATH' ) || exit;

define( 'EGECELIKEL_SITE_DIR', __DIR__ . '/site' );

/**
 * File types that may be served. Anything else (e.g. .php) is never sent.
 */
function egecelikel_site_mime_types() {
	return array(
		'html'  => 'text/html; charset=utf-8',
		'htm'   => 'text/html; charset=utf-8',
		'css'   => 'text/css; charset=utf-8',
		'js'    => 'text/javascript; charset=utf-8',
		'mjs'   => 'text/javascript; charset=utf-8',
		'json'  => 'application/json; charset=utf-8',
		'txt'   => 'text/plain; charset=utf-8',
		'svg'   => 'image/svg+xml',
		'png'   => 'image/png',
		'jpg'   => 'image/jpeg',
		'jpeg'  => 'image/jpeg',
		'gif'   => 'image/gif',
		'webp'  => 'image/webp',
		'avif'  => 'image/avif',
		'ico'   => 'image/x-icon',
		'woff'  => 'font/woff',
		'woff2' => 'font/woff2',
		'ttf'   => 'font/ttf',
		'otf'   => 'font/otf',
		'mp3'   => 'audio/mpeg',
		'ogg'   => 'audio/ogg',
		'wav'   => 'audio/wav',
		'mp4'   => 'video/mp4',
		'webm'  => 'video/webm',
		'glb'   => 'model/gltf-binary',
		'gltf'  => 'model/gltf+json',
		'wasm'  => 'application/wasm',
	);
}

/**
 * The request path relative to the site root, without leading slash, URL-decoded.
 */
function egecelikel_site_request_path() {
	$uri  = isset( $_SERVER['REQUEST_URI'] ) ? wp_unslash( $_SERVER['REQUEST_URI'] ) : '/';
	$path = (string) wp_parse_url( $uri, PHP_URL_PATH );
	$home = (string) wp_parse_url( home_url( '/' ), PHP_URL_PATH );
	$home = '' === $home ? '/' : $home;

	if ( 0 === strpos( $path, $home ) ) {
		$path = substr( $path, strlen( $home ) );
	}

	return rawurldecode( ltrim( $path, '/' ) );
}

/**
 * Send a file from site/ and stop WordPress. Returns false if the file may not be served.
 *
 * @param string $relative Path relative to site/.
 */
function egecelikel_site_send( $relative ) {
	$base = realpath( EGECELIKEL_SITE_DIR );
	if ( false === $base || false !== strpos( $relative, "\0" ) ) {
		return false;
	}

	$file = realpath( $base . '/' . $relative );

	if ( false !== $file && is_dir( $file ) ) {
		$file = realpath( $file . '/index.html' );
	}

	// Must exist, be a regular file, and stay inside site/ (blocks ../ tricks).
	if ( false === $file || ! is_file( $file ) || 0 !== strpos( $file, $base . DIRECTORY_SEPARATOR ) ) {
		return false;
	}

	$types = egecelikel_site_mime_types();
	$ext   = strtolower( pathinfo( $file, PATHINFO_EXTENSION ) );
	if ( ! isset( $types[ $ext ] ) ) {
		return false;
	}

	status_header( 200 );
	header( 'Content-Type: ' . $types[ $ext ] );
	header( 'X-Content-Type-Options: nosniff' );
	header( 'Referrer-Policy: strict-origin-when-cross-origin' );
	header( 'X-Frame-Options: SAMEORIGIN' );
	header( 'Cache-Control: public, max-age=300' );

	if ( 'HEAD' === ( isset( $_SERVER['REQUEST_METHOD'] ) ? $_SERVER['REQUEST_METHOD'] : 'GET' ) ) {
		exit;
	}

	if ( 'html' === $ext || 'htm' === $ext ) {
		$rel_dir = trim( str_replace( '\\', '/', dirname( substr( $file, strlen( $base ) + 1 ) ) ), '/.' );
		echo egecelikel_site_fix_asset_urls( file_get_contents( $file ), $rel_dir ); // phpcs:ignore WordPress.Security.EscapeOutput -- our own static file.
	} else {
		readfile( $file );
	}
	exit;
}

/**
 * The web server answers .js, .css, font and image requests itself and never passes them to
 * WordPress, so a page served at /projects/foo/ cannot load "js/app.js" from /projects/foo/js/.
 * Point relative asset URLs at the files' real location inside this plugin instead, and tell
 * scripts that build asset URLs at runtime via window.SITE_ASSET_BASE.
 *
 * @param string $html    Page HTML.
 * @param string $rel_dir Folder of the page relative to site/ ('' for the root).
 */
function egecelikel_site_fix_asset_urls( $html, $rel_dir ) {
	$asset_base = plugins_url( 'site/' . ( '' === $rel_dir ? '' : $rel_dir . '/' ), __FILE__ );

	// src/href on script, link, img, source, audio, video, unless absolute, root-relative, a fragment or a scheme (data:, https:...).
	$html = preg_replace_callback(
		'#(<(?:script|link|img|source|audio|video)\b[^>]*?\s(?:src|href)=)(["\'])(?![\#/]|[a-zA-Z][a-zA-Z0-9+.\-]*:)([^"\']+)\2#i',
		function ( $m ) use ( $asset_base ) {
			return $m[1] . $m[2] . esc_url( $asset_base . $m[3] ) . $m[2];
		},
		$html
	);

	$setup = '<script>window.SITE_ASSET_BASE = ' . wp_json_encode( $asset_base ) . ';</script>';
	$count = 0;
	$html  = preg_replace( '#<head\b[^>]*>#i', '$0' . $setup, $html, 1, $count );

	return $count ? $html : $setup . $html;
}

/**
 * Route requests. Runs before WordPress's own canonical redirects (priority 0).
 */
function egecelikel_site_route() {
	$path = egecelikel_site_request_path();

	// /projects and /projects/... -> site/projects/...
	if ( 'projects' === $path || 0 === strpos( $path, 'projects/' ) ) {
		// A folder without a trailing slash: redirect so relative links in it work.
		if ( '/' !== substr( $path, -1 ) && false === strpos( $path, '..' ) && is_dir( EGECELIKEL_SITE_DIR . '/' . $path ) ) {
			wp_safe_redirect( home_url( '/' . $path . '/' ), 301 );
			exit;
		}
		egecelikel_site_send( $path );
		return; // Not found: let WordPress show its 404.
	}

	// The front page -> site/index.html. Previews, feeds, searches and page 2+ stay with WordPress.
	if ( is_front_page() && ! is_paged() && ! is_feed() && ! is_search() && ! is_preview() && ! is_customize_preview() ) {
		egecelikel_site_send( 'index.html' );
	}
}
add_action( 'template_redirect', 'egecelikel_site_route', 0 );
