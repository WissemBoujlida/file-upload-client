import axios, { AxiosError, AxiosInstance } from "axios";
import { sleep } from "@/lib/sleep";

declare module "axios" {
  export interface AxiosRequestConfig {
    _noRetry?: boolean;
    _attempts?: number;
  }
}

const MAX_RETRIES = 3;

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_APP_URL,
  allowAbsoluteUrls: true,
  timeout: 5000,
});

const s3 = axios.create({
  timeout: 0,
});

async function retryWithExponentialBackoff(
  instance: AxiosInstance,
  error: AxiosError,
) {
  const config = error.config;

  if (!config || config._noRetry) {
    return Promise.reject(error);
  }

  const shouldRetry =
    !error.response ||
    error.response?.status === 429 ||
    (error.response?.status >= 500 && error.response?.status < 600);

  // only retry on network or 5xx server errors
  if (!shouldRetry) {
    return Promise.reject(error);
  }

  config._attempts = config._attempts ?? 0;

  if (config._attempts >= MAX_RETRIES) {
    return Promise.reject(error);
  }

  config._attempts++;

  // 429 Too Many Requests often includes a Retry-After header telling you exactly how long to wait
  const retryAfterHeader = error.response?.headers["retry-after"];

  const delay = retryAfterHeader
    ? parseFloat(retryAfterHeader) * 1000
    : 1000 * 2 ** config._attempts; // wait for 2, 4, 8 seconds before retrying (exponential backoff)
  await sleep(delay);

  return instance(config);
}

// add _noRetry: true to request config if you don't want to retry a request (eg: non idompotent mutations)
api.interceptors.response.use(
  (response) => response,
  (error) => retryWithExponentialBackoff(api, error),
);

s3.interceptors.response.use(
  (response) => response,
  (error) => retryWithExponentialBackoff(s3, error),
);

export { api, s3 };
