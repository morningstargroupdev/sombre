import type { Picture } from "../lib/api";

interface Props {
  images: Picture[];
  onRemove: (image: Picture) => void;
}

export const Strip = ({ images, onRemove }: Props) => (
  <div className="flex gap-2.5 overflow-x-auto px-3.5 pt-3">
    {images.map((image, index) => (
      <div className="relative shrink-0" key={image.path}>
        <img
          alt={`attachment ${index + 1}`}
          className="border-rim size-14 rounded-lg border object-cover"
          src={image.src}
        />
        <span className="bg-ink text-paper absolute bottom-1 left-1 rounded-full px-1.5 text-[10.5px] font-semibold">
          {index + 1}
        </span>
        <button
          aria-label={`remove attachment ${index + 1}`}
          className="border-rim bg-raise text-paper hover:bg-well active:bg-rim absolute -top-1.5 -right-1.5 flex size-5 cursor-pointer items-center justify-center rounded-full border text-[11px]"
          onClick={() => onRemove(image)}
          type="button"
        >
          ×
        </button>
      </div>
    ))}
  </div>
);
