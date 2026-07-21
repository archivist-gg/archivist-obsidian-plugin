import type { CropParams } from "../pc.portrait";
import { cropCssProps } from "../pc.portrait";
import { setPortraitPlaceholderIcon } from "../assets/portrait-icon";

/**
 * Mounts avatar content into `host`: a cropped portrait image when
 * `portraitUrl` is set, or the d20 placeholder icon otherwise. Shared by the
 * header avatar button and the builder topbar mini avatar so both surfaces
 * stay in lockstep instead of duplicating the img/icon branch.
 *
 * `portraitCrop` only takes effect alongside a `portraitUrl` - it adds the
 * `pc-avatar-cropped` class plus the `--pc-crop-*` custom props that the CSS
 * uses to position the image inside the (square) host box. Without a crop,
 * the image falls back to the existing `object-fit: cover` framing.
 */
export function renderAvatarContent(
  host: HTMLElement,
  portraitUrl: string | null | undefined,
  portraitCrop: CropParams | null | undefined,
): void {
  if (portraitUrl) {
    host.createEl("img", { cls: "pc-avatar-img", attr: { src: portraitUrl, alt: "" } });
    if (portraitCrop) {
      host.addClass("pc-avatar-cropped");
      host.setCssProps(cropCssProps(portraitCrop));
    }
  } else {
    setPortraitPlaceholderIcon(host);
  }
}
