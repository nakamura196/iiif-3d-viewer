'use client';

import type { ContainerInfo, MediaOption } from '../../core';
import { labelIn } from '../../core';
import { useLocale } from '../env';
import ImageView from './ImageView';

// 画像 1 枚（選ばれた中身）の表示。画像の機能（拡大・重ね表示など）はここと ImageView に足す。
export default function ImagePainting({ container, option }: { container: ContainerInfo; option: MediaOption }) {
  const locale = useLocale();
  return <ImageView key={option.url} src={option.url} alt={labelIn(container.label, locale)} />;
}
