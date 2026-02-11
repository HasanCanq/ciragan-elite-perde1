import Iyzipay from 'iyzipay';

// =====================================================
// IYZICO CLIENT - Lazy Singleton (build-safe)
// =====================================================

let _iyzipay: Iyzipay | null = null;

function getIyzipay(): Iyzipay {
  if (!_iyzipay) {
    _iyzipay = new Iyzipay({
      apiKey: process.env.IYZICO_API_KEY!,
      secretKey: process.env.IYZICO_SECRET_KEY!,
      uri: process.env.IYZICO_BASE_URL || 'https://sandbox-api.iyzipay.com',
    });
  }
  return _iyzipay;
}

// =====================================================
// TYPE DEFINITIONS
// =====================================================

export interface IyzicoPaymentCard {
  cardHolderName: string;
  cardNumber: string;
  expireMonth: string;
  expireYear: string;
  cvc: string;
  registerCard?: '0' | '1';
}

export interface IyzicoBuyer {
  id: string;
  name: string;
  surname: string;
  gsmNumber?: string;
  email: string;
  identityNumber: string;
  registrationAddress: string;
  ip: string;
  city: string;
  country: string;
  zipCode?: string;
}

export interface IyzicoAddress {
  contactName: string;
  city: string;
  country: string;
  address: string;
  zipCode?: string;
}

export interface IyzicoBasketItem {
  id: string;
  name: string;
  category1: string;
  category2?: string;
  itemType: 'PHYSICAL' | 'VIRTUAL';
  price: string;
}

export interface IyzicoThreedsInitRequest {
  locale: string;
  conversationId: string;
  price: string;
  paidPrice: string;
  currency: string;
  installment: string;
  basketId: string;
  paymentChannel: string;
  paymentGroup: string;
  callbackUrl: string;
  paymentCard: IyzicoPaymentCard;
  buyer: IyzicoBuyer;
  shippingAddress: IyzicoAddress;
  billingAddress: IyzicoAddress;
  basketItems: IyzicoBasketItem[];
}

export interface IyzicoThreedsInitResponse {
  status: string;
  locale: string;
  systemTime: number;
  conversationId: string;
  threeDSHtmlContent: string;
  paymentId?: string;
  signature?: string;
  errorCode?: string;
  errorMessage?: string;
  errorGroup?: string;
}

export interface IyzicoThreedsAuthRequest {
  locale: string;
  conversationId: string;
  paymentId: string;
  conversationData?: string;
}

export interface IyzicoThreedsAuthResponse {
  status: string;
  locale: string;
  systemTime: number;
  conversationId: string;
  paymentId: string;
  price: number;
  paidPrice: number;
  currency: string;
  installment: number;
  basketId: string;
  fraudStatus: number;
  mdStatus: string;
  authCode?: string;
  errorCode?: string;
  errorMessage?: string;
  signature?: string;
}

// =====================================================
// PROMISE WRAPPERS
// =====================================================

export function threedsInitialize(
  request: IyzicoThreedsInitRequest
): Promise<IyzicoThreedsInitResponse> {
  return new Promise((resolve, reject) => {
    getIyzipay().threedsInitialize.create(
      request,
      (err: Error | null, result: IyzicoThreedsInitResponse) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}

export function threedsPayment(
  request: IyzicoThreedsAuthRequest
): Promise<IyzicoThreedsAuthResponse> {
  return new Promise((resolve, reject) => {
    getIyzipay().threedsPayment.create(
      request,
      (err: Error | null, result: IyzicoThreedsAuthResponse) => {
        if (err) return reject(err);
        resolve(result);
      }
    );
  });
}
