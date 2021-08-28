import { MessageBox } from 'element-ui';


const _isType = (type) => (target) =>
    Object.prototype.toString.call(target) === '[object ' + type + ']';

export const is_array = _isType('Array');
export const is_number = _isType('Number');
export const is_string = _isType('String');
export const is_object = _isType('Object');

export function get_img_src_or_url(str = '') {
    const reg = /src=[\'\"]?([^\'\"]*)[\'\"]?/i;
    const match = reg.exec(str);

    if (str.startsWith('http')) {
        return str;
    } else if (match && match[1]) {
        return match[1];
    }

    return '';
}

export function get_image_natural_wh(url) {
    return new Promise((resolve) => {
        const img = new Image();

        img.src = url;
        img.onload = () => {
            return resolve({width: img.width, height: img.height});
        };
        img.onerror = () => {
            return resolve({width: 0, height: 0});
        };
    });
}

export async function confirm_message(message, title = '提示', type = 'warning', options) {
    try {
        await MessageBox.confirm(message, title,
            Object.assign({}, {confirmButtonText: '确定', cancelButtonText: '取消', type}, options));
        return true;
    } catch (err) {
        return false;
    }
}

export function network_url_replace_to_root_url(raw_url, has_line = true) {
    const replacer = has_line ? '/' : '';
    return raw_url
        .replace('https://', 'http://')
        .replace(/http:\/\/(.*?)\//i, replacer);
}
