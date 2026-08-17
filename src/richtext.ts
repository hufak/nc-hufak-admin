/** NcRichText renders Markdown the way the rest of Nextcloud does, but it drags
 * the whole unified/remark/rehype stack in with it. It is therefore kept out
 * of the main bundle: pages that show Markdown import
 * this module on demand, so it only reaches the browser once one is opened. */
import NcRichText from '@nextcloud/vue/components/NcRichText';

export { NcRichText };
