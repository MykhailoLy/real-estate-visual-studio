import assert from "node:assert/strict";
import test from "node:test";
import { costaBlancaDemo } from "./registry.ts";
import {
  normalizePropertyVideoInput,
  normalizePropertyVideoUrls,
  sortedUsablePropertyVideos,
} from "./video-urls.ts";
import type { PropertyShowcase } from "./types.ts";

test("normalizes trusted YouTube and Vimeo public URLs into embed metadata", () => {
  const youtube = normalizePropertyVideoInput("youtube", {
    value: "https://youtu.be/aqz-KE-bpKQ",
  });
  const vimeo = normalizePropertyVideoInput("vimeo", {
    value: "https://vimeo.com/76979871",
  });

  assert.equal(youtube?.playbackId, "aqz-KE-bpKQ");
  assert.equal(
    youtube?.embedUrl,
    "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
  );
  assert.equal(vimeo?.embedUrl, "https://player.vimeo.com/video/76979871");
});

test("normalizes Cloudflare Stream and Mux playback URLs", () => {
  const cloudflare = normalizePropertyVideoInput("cloudflare-stream", {
    value: "https://watch.videodelivery.net/abcDEF_123456",
  });
  const mux = normalizePropertyVideoInput("mux", {
    playbackId: "muxPlayback_123456",
  });

  assert.equal(
    cloudflare?.embedUrl,
    "https://iframe.videodelivery.net/abcDEF_123456",
  );
  assert.equal(mux?.embedUrl, "https://player.mux.com/muxPlayback_123456");
});

test("rejects arbitrary and lookalike video iframe origins", () => {
  assert.equal(
    normalizePropertyVideoInput("youtube", {
      value: '<iframe src="https://youtube.com.evil.example/embed/aqz-KE-bpKQ"></iframe>',
    }),
    null,
  );
  assert.equal(
    normalizePropertyVideoInput("vimeo", {
      value: "https://evil.example/video/76979871",
    }),
    null,
  );
  assert.equal(
    normalizePropertyVideoInput("youtube", {
      value: "https://user:pass@www.youtube.com/watch?v=aqz-KE-bpKQ",
    }),
    null,
  );
});

test("custom video embeds require an exact configured HTTPS origin", () => {
  const original = process.env.PROPERTY_SHOWCASE_TRUSTED_VIDEO_ORIGINS;
  process.env.PROPERTY_SHOWCASE_TRUSTED_VIDEO_ORIGINS =
    "https://video.example.com";
  try {
    const trusted = normalizePropertyVideoInput("custom", {
      value: '<iframe src="https://video.example.com/embed/listing"></iframe>',
    });
    assert.equal(trusted?.embedUrl, "https://video.example.com/embed/listing");
    assert.equal(
      normalizePropertyVideoInput("custom", {
        value: '<iframe src="https://video.example.com.evil.test/embed/listing"></iframe>',
      }),
      null,
    );
  } finally {
    if (original === undefined) {
      delete process.env.PROPERTY_SHOWCASE_TRUSTED_VIDEO_ORIGINS;
    } else {
      process.env.PROPERTY_SHOWCASE_TRUSTED_VIDEO_ORIGINS = original;
    }
  }
});

test("disabled video metadata is retained but has no visible videos", () => {
  const property: PropertyShowcase = structuredClone(costaBlancaDemo);
  property.videos = {
    enabled: false,
    items: [
      {
        id: "film",
        provider: "youtube",
        externalUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        sortOrder: 1,
      },
    ],
  };

  const normalized = normalizePropertyVideoUrls(property);
  assert.equal(normalized.ok, true);
  assert.equal(normalized.property?.videos?.items.length, 1);
  assert.deepEqual(sortedUsablePropertyVideos(normalized.property!), []);
});

test("visible videos put the primary first and ignore disabled items", () => {
  const property: PropertyShowcase = structuredClone(costaBlancaDemo);
  property.videos = {
    enabled: true,
    items: [
      {
        id: "first",
        provider: "youtube",
        externalUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
        embedUrl: "https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ",
        sortOrder: 1,
      },
      {
        id: "primary",
        provider: "vimeo",
        externalUrl: "https://vimeo.com/76979871",
        embedUrl: "https://player.vimeo.com/video/76979871",
        primary: true,
        sortOrder: 2,
      },
      {
        id: "disabled",
        provider: "vimeo",
        externalUrl: "https://vimeo.com/76979871",
        enabled: false,
        sortOrder: 3,
      },
    ],
  };

  assert.deepEqual(
    sortedUsablePropertyVideos(property).map((video) => video.id),
    ["primary", "first"],
  );
});
