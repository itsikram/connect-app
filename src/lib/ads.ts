import { AppOpenAd, AdEventType, TestIds, RequestOptions } from 'react-native-google-mobile-ads';
import { Platform } from 'react-native';

const PRODUCTION_APP_OPEN_AD_UNIT_ID = Platform.select({
  ios: 'ca-app-pub-8953965236531270/4167948202',
  android: 'ca-app-pub-8953965236531270/4167948202',
}) as string;

const APP_OPEN_AD_UNIT_ID = __DEV__ ? TestIds.APP_OPEN : PRODUCTION_APP_OPEN_AD_UNIT_ID;

class AppOpenAdManager {
  private ad: AppOpenAd | null = null;
  private isLoading: boolean = false;
  private isShowing: boolean = false;

  loadAd = () => {
    if (this.isLoading || this.ad) return;
    this.isLoading = true;

    const requestOptions: RequestOptions = {};

    const ad = AppOpenAd.createForAdRequest(APP_OPEN_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    ad.addAdEventListener(AdEventType.LOADED, () => {
      this.ad = ad;
      this.isLoading = false;
    });

    ad.addAdEventListener(AdEventType.ERROR, () => {
      this.isLoading = false;
      this.ad = null;
    });

    ad.load();
  };

  showAdIfAvailable = async () => {
    if (this.isShowing) return;

    if (this.ad) {
      try {
        this.isShowing = true;
        await this.ad.show();
      } catch (e) {
      } finally {
        this.isShowing = false;
        this.ad?.removeAllListeners();
        this.ad = null;
        // Preload next
        this.loadAd();
      }
    } else if (!this.isLoading) {
      this.loadAd();
    }
  };

  preloadAndShowOnLoad = () => {
    if (this.ad) {
      this.showAdIfAvailable();
      return;
    }

    const ad = AppOpenAd.createForAdRequest(APP_OPEN_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: false,
    });

    const onLoaded = async () => {
      ad.removeAllListeners();
      this.ad = ad;
      await this.showAdIfAvailable();
    };

    const onError = () => {
      ad.removeAllListeners();
      this.ad = null;
    };

    ad.addAdEventListener(AdEventType.LOADED, onLoaded);
    ad.addAdEventListener(AdEventType.ERROR, onError);
    ad.load();
  };
}

export const appOpenAdManager = new AppOpenAdManager();


