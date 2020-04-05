import { remote } from 'electron';
import { minPollIntervalMinutes, maxPollIntervalMinutes } from './constants';

const notifySlack: Function = remote.getGlobal('notifySlack');
const scanStatus: Function = remote.getGlobal('scanStatus');
const incrementScanCount: Function = remote.getGlobal('incrementScanCount');
const getScanCount: Function = remote.getGlobal('getScanCount');

function navigateBack() {
  remote.getCurrentWindow().webContents.goBack();
}

function canStartScan() {
  const el = document.querySelector('span[data-action~="cart-go-checkout"] a') as HTMLAnchorElement;
  if (!el) return null;
  if (el.getAttribute('aria-disabled') !== "false") return null;

  return el;
}

function isOnDeliveryWindowPage() {
  return document.querySelector('#delivery-slot-form') as HTMLElement;
}

function randomNumber(min: number, max: number) {
  min = Math.ceil(min);
  max = Math.floor(max);

  return Math.floor(Math.random() * (max - min + 1)) + min;
}  

const re = /No delivery/i;

function isDeliverySlotAvailable() {
  const el = isOnDeliveryWindowPage();
  if (!el) return false;

  return !el.innerText.match(re);
}

document.addEventListener('DOMContentLoaded', (_e) => {
  const isScanning = scanStatus();
  const scanCount = getScanCount();

  if (isOnDeliveryWindowPage()) {
    // NB: Delivery window info gets AJAXed in
    setTimeout(() => {
      if (isDeliverySlotAvailable()) {
        notifySlack('*There is a slot!!!* Go Go Go! https://primenow.amazon.com/cart?ref_=pn_gw_nav_cart');
      }
      
      incrementScanCount();
      setTimeout(() => navigateBack(), randomNumber(2,4) * 1000);
    }, 2000);
  }

  let scanToken: NodeJS.Timeout;
  if (isScanning) {
    const delaySeconds = scanCount > 0 ? 
      randomNumber(/*3, 10*/minPollIntervalMinutes*60, maxPollIntervalMinutes*60) :
      1;
    
    scanToken = setTimeout(() => {
      const el = canStartScan();
      if (el) el.click();
    }, delaySeconds * 1000);
  }

  const button = document.createElement('button');
  button.setAttribute('class', 'a-button a-button-normal');
  button.style.minWidth = '128px';
  button.style.minHeight = '24px';
  button.style.marginTop = '8px';

  button.innerText = isScanning ? `Stop scanning (${scanCount} scans performed)`: 'Scan for Delivery Windows';

  if (isScanning) {
    button.addEventListener('click', (_e) => {
      scanStatus(false);
      notifySlack('Cancelling scan...');
      incrementScanCount(0);

      clearTimeout(scanToken);
      window.location.href = window.location.href;
    });
  } else {
    button.addEventListener('click', (_e) => {
      if (!canStartScan()) {
        window.alert("Can't start the scan! Make sure you're on the checkout page with a few items in the cart")
        return;
      }

      notifySlack('Starting scan...');
      scanStatus(true);

      window.location.href = window.location.href;
    });
  }

  const flash = document.createElement('h1');
  flash.innerText = 'Navigate to the checkout page!';
  flash.style.zIndex = '100000';
  flash.style.color = 'black';
  flash.style.position = 'absolute';

  const buttonHost = document.querySelector('.cart-checkout-box div');
  if (buttonHost) {
    buttonHost.appendChild(button);
  } else {
    setTimeout(() => document.body.prepend(flash), 2000);
  }
});
