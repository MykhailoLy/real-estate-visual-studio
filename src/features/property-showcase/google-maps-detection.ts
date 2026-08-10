export interface GoogleMapsLinkDetectionRequest {
  id: number;
  link: string;
  controller: AbortController;
}

/**
 * Keeps only the latest admin-side Google Maps detection request authoritative.
 * The component still verifies the live input value before writing React state.
 */
export class GoogleMapsLinkDetectionCoordinator {
  private activeRequest: GoogleMapsLinkDetectionRequest | null = null;
  private requestId = 0;

  begin(link: string): GoogleMapsLinkDetectionRequest {
    this.activeRequest?.controller.abort();

    const request = {
      id: ++this.requestId,
      link: link.trim(),
      controller: new AbortController(),
    };
    this.activeRequest = request;
    return request;
  }

  invalidateForInputChange(link: string): boolean {
    if (!this.activeRequest || this.activeRequest.link === link.trim()) {
      return false;
    }

    this.activeRequest.controller.abort();
    this.activeRequest = null;
    return true;
  }

  isCurrent(
    request: GoogleMapsLinkDetectionRequest,
    currentLink: string,
  ): boolean {
    return (
      this.activeRequest?.id === request.id &&
      !request.controller.signal.aborted &&
      request.link === currentLink.trim()
    );
  }

  finish(
    request: GoogleMapsLinkDetectionRequest,
    currentLink: string,
  ): boolean {
    if (!this.isCurrent(request, currentLink)) return false;
    this.activeRequest = null;
    return true;
  }

  dispose() {
    this.activeRequest?.controller.abort();
    this.activeRequest = null;
  }
}
