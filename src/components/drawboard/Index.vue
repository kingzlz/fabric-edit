<template>
    <div class="module_draw_dialog">
        <p class="module_draw_dialog_tip">滚轮上下滑动可拖动图片 / 按住alt+滚轮上下滑动可对图片进行缩放 / 按住alt+鼠标左键进行拖动</p>

        <div class="draw_wrapper" ref="draw_wrapper" :style="{height: draw_content_height + 'px'}"
             v-loading="img_loading"
             element-loading-text="图片加载中">
            <canvas ref="canvas" :width="canvas_wh.width" :height="canvas_wh.height">你的浏览器不支持 canvas，请升级你的浏览器</canvas>
        </div>


        <div class="picker_item color_picker">
            <span class="picker_title">颜色:</span>
            <el-color-picker title="选择颜色" v-model="color" size="mini"/>
        </div>

        <div class="picker_item size_picker">
            <span class="picker_title">笔触:</span>
            <el-input class="picker_input" v-model="size_input_val" size="mini">
                <el-button slot="append" :icon="!show_picker_slider ? 'el-icon-arrow-down' : 'el-icon-arrow-up'"
                           @click.stop="show_picker_slider = !show_picker_slider"/>
            </el-input>
            <div class="picker_slider" v-show="show_picker_slider">
                <el-slider input-size="mini" :show-tooltip="false" v-model="size_picker_val"
                           :max="picker_min_max_size.max"
                           :min="picker_min_max_size.min"/>
            </div>
        </div>

        <div title="放大" class="zoom_in_btn el-icon el-icon-circle-plus-outline" @click.stop="set_zoom(true)"></div>
        <p class="zoom_text">{{ zoom }}%</p>
        <div title="缩小" class="zoom_out_btn el-icon el-icon-remove-outline" @click.stop="set_zoom(false)"></div>
        <el-button title="选择" class="move_btn" icon="el-icon-rank" circle size="mini"
                   :type="in_move_mode ? 'success' : 'info'"
                   @click.stop="change_move_mode"/>
        <el-button title="删除所选" class="delete_btn" icon="el-icon-delete" circle size="mini" type="danger"
                   @click.stop="delete_selected"/>

        <ul class="draw_control">
            <li :class="['draw_control_item', {active: index === current_button_index && !in_move_mode}]"
                v-for="(img_name, index) in 13"
                :style="{width: 100 / 13 + '%'}" :key="index"
                @click.stop="button_clicked(index)">
                <img :src="require('./btns/' + img_name + '.png')" alt="">
                <p>{{ btn_names[index] }}</p>
            </li>
        </ul>

        <el-dialog class="draw_rotate_dialog" title="提示" :visible.sync="rotate_dialog" width="40%" append-to-body>
            <p class="draw_rotate_text">
                <i class="el-message-box__status el-icon-warning"></i>
                旋转会重置绘图状态，是否确定
            </p>
            <el-checkbox class="draw_rotate_checkbox" v-model="rotate_dialog_checked">以后不再提醒</el-checkbox>
            <span slot="footer" class="dialog-footer">
      <el-button size="small" @click="rotate_dialog = false">取 消</el-button>
      <el-button size="small" type="primary" @click="rotate_dialog_submit">确 定</el-button>
    </span>
        </el-dialog>
    </div>
</template>
<script>
    import Drawboard, { DrawMode } from './drawboard';
    import { get_img_src_or_url, get_image_natural_wh, confirm_message } from './utils';
    import { is_array, network_url_replace_to_root_url } from './utils';

    import {
        register_arror_draw,
        register_right_draw,
        register_wrong_draw,
        register_aplus_draw,
        register_aminus_draw,
    } from './custom';

    const DEFAULT_MODE = 4; // 默认画笔模式
    const DEFAULT_ANGLE = 0; // 默认旋转角度
    const DEFAULT_ZOOM = 100; // 默认缩放比例
    const DEFAULT_COLOR = '#FF0000'; // 默认颜色

    // 字体大小
    const DEFAULT_FONT_SIZE = 16; // 默认字体大小
    const DEFAULT_MAX_FONT_SIZE = 128;
    const DEFAULT_MIN_FONT_SIZE = 32;

    // 线宽大小
    const DEFAULT_BRUSH_WIDTH = 4;
    const DEFAULT_MAX_BRUSH_WIDTH = 32;
    const DEFAULT_MIN_BRUSH_WIDTH = 4;

    const ROTATE_DIALOG_KEY = 'noshowdrawrotatedialog';
    const ROTATE_DIALOG_VAL = '1';


    export default {
        name: 'newIndex',
        data() {
            return {
                img_loading: false,
                drawboard: null,
                btn_names: [
                    '画框', '画圆', '箭头', '直线', '画笔', '输入',
                    '撤销', '清屏', '正确', '错误', 'A+', 'A-', '旋转',
                ],
                current_button_index: 4,
                color: DEFAULT_COLOR,
                // 处于移动模式
                in_move_mode: false,
                /** 事件 */
                delete_event: (_) => {},
                /** 初始状态 */
                init_state: {
                    is_img: false,
                    img_check: true,
                    data: ''
                },
                /** 旋转 angle */
                rotate_angle: DEFAULT_ANGLE,
                /** 缩放 */
                init_zoom: DEFAULT_ZOOM / 100,
                zoom: DEFAULT_ZOOM,
                /** 字体大小 */
                font_size: DEFAULT_FONT_SIZE,
                /** canvas width & height */
                canvas_wh: {width: 1000, height: 450},
                /** 笔刷大小 */
                brush_width: DEFAULT_BRUSH_WIDTH,

                rotate_dialog: false,
                rotate_dialog_checked: false,

                draw_content_height: 450,

                current_size_mode_is_font: false, // 当前 size 模式是调整字体大小
                size_input_val: DEFAULT_BRUSH_WIDTH,
                size_picker_val: DEFAULT_BRUSH_WIDTH,
                show_picker_slider: false,
            }
        },
        computed: {
            picker_min_max_size() {
                if (this.current_size_mode_is_font) {
                    return {min: DEFAULT_MIN_FONT_SIZE, max: DEFAULT_MAX_FONT_SIZE};
                }

                return {min: DEFAULT_MIN_BRUSH_WIDTH, max: DEFAULT_MAX_BRUSH_WIDTH};
            }
        },
        watch: {
            color(val) {
                if (!this.show) {
                    return;
                }
                if (!this.drawboard) {
                    return;
                }

                this.drawboard.set_brush({color: val, width: this.brush_width});
            },
            brush_width(val) {
                if (!this.show) {
                    return;
                }
                if (!this.drawboard) {
                    return;
                }

                this.set_zoom_size();
            },
            font_size(val) {
                if (!this.show) {
                    return;
                }
                if (!this.drawboard) {
                    return;
                }

                this.set_zoom_size();
            },
            async show(val) {
                if (!val) {
                    this.rotate_angle = DEFAULT_ANGLE;
                    this.zoom = DEFAULT_ZOOM;
                    this.in_move_mode = false;
                    this.brush_width = DEFAULT_BRUSH_WIDTH;
                    this.font_size = DEFAULT_FONT_SIZE;
                    this.init_zoom = DEFAULT_ZOOM / 100;
                    this.current_size_mode_is_font = false;
                    this.show_picker_slider = false;
                    this.size_input_val = DEFAULT_BRUSH_WIDTH;
                    this.size_picker_val = DEFAULT_BRUSH_WIDTH;
                    this.color = DEFAULT_COLOR;
                }
            },
            size_input_val(val) {
                const num = Number(val);
                this.size_picker_val = num;
            },
            size_picker_val(val) {
                this.size_input_val = val;

                if (this.current_size_mode_is_font) {
                    this.font_size = val;
                } else {
                    this.brush_width = val;
                }
            },
            current_button_index(val) {
                this.current_size_mode_is_font = [5, 10, 11].indexOf(val) !== -1;
            },
            current_size_mode_is_font(val) {
                this.size_input_val = val ? this.font_size : this.brush_width;
            }
        },
        mounted() {
            this.delete_event = this.delete_handler.bind(this);
            window.addEventListener('keyup', this.delete_event);
            this.init_drawboard()
        },
        destroyed() {
            window.removeEventListener('keyup', this.delete_event);
            if (!this.drawboard) {
                return;
            }
            this.drawboard.destroyed();
        },
        methods: {
            init_drawboard() {
                if (this.drawboard) {
                    return;
                }
                const $canvas = this.$refs.canvas;
                if (!$canvas) {
                    console.error('[draw-dialog] canvas not found!');
                    return;
                }

                this.drawboard = new Drawboard({
                    canvas: $canvas,
                    brush_color: this.color,
                    brush_width: DEFAULT_BRUSH_WIDTH,
                    mode: DrawMode.PEN,
                    back_event: (history) => {
                        if (!history.length) {
                            this.$message.warning('没有可撤销的记录了');
                            this.draw_init_state();
                        }
                    },
                    zoom_change: (zoom) => {
                        const scale = zoom / this.init_zoom;
                        const z = parseInt(`${ scale * 100 }`, 10);
                        this.zoom = z;
                        this.set_zoom_size();
                    },
                    drag_event: (status) => {
                        if (status) {
                            this.in_move_mode = false;
                        }
                    },
                });
                this.current_button_index = DEFAULT_MODE;
                this.register_custom_draw_func();

                window.drawboard = this.drawboard;
            },

            destroy_drawboard() {
                if (this.drawboard) {
                    this.drawboard.destroyed();
                }
                this.drawboard = null;
            },

            async reset_canvas() {
                await this.$nextTick();
                this.destroy_drawboard();
                this.init_drawboard();
            },

            button_clicked(button_index) {
                console.log(button_index)
                if (!this.drawboard) {
                    return;
                }

                // 退出移动模式
                if (this.in_move_mode && ([6, 7].indexOf(button_index) === -1)) {
                    this.in_move_mode = false;
                }

                switch (button_index) {
                    case 0: // 画矩形
                        this.drawboard.set_mode(DrawMode.RECT);
                        this.current_button_index = button_index;
                        break;
                    case 1: // 画圆
                        this.drawboard.set_mode(DrawMode.CIRCLE);
                        this.current_button_index = button_index;
                        break;
                    case 2: // 画箭头
                        this.drawboard.set_custom_draw_func_enable([this.btn_names[button_index]]);
                        this.current_button_index = button_index;
                        break;
                    case 3: // 画直线
                        this.drawboard.set_mode(DrawMode.LINE);
                        this.current_button_index = button_index;
                        break;
                    case 4: // 画笔
                        this.drawboard.set_mode(DrawMode.PEN);
                        this.current_button_index = button_index;
                        break;
                    case 5: // 输入文字
                        this.drawboard.set_mode(DrawMode.TEXT);
                        this.current_button_index = button_index;
                        break;
                    case 6: // 撤销
                        this.drawboard.back();
                        break;
                    case 7: // 清屏
                        this.drawboard.clear();
                        this.draw_init_state();
                        break;
                    case 8: // 勾
                        this.drawboard.set_custom_draw_func_enable([this.btn_names[button_index]]);
                        this.current_button_index = button_index;
                        break;
                    case 9: // 叉
                        this.drawboard.set_custom_draw_func_enable([this.btn_names[button_index]]);
                        this.current_button_index = button_index;
                        break;
                    case 10: // A+
                        this.drawboard.set_custom_draw_func_enable([this.btn_names[button_index]]);
                        this.current_button_index = button_index;
                        break;
                    case 11: // A-
                        this.drawboard.set_custom_draw_func_enable([this.btn_names[button_index]]);
                        this.current_button_index = button_index;
                        break;
                    case 12: // 旋转
                        const status = window.localStorage.getItem(ROTATE_DIALOG_KEY);
                        if (status === ROTATE_DIALOG_VAL) {
                            this.rotate();
                        } else {
                            this.rotate_dialog = true;
                        }
                        break;
                }
            },

            close() {
                this.close_handler();
            },

            submit() {
                if (!this.drawboard) {
                    return;
                }
                const base64 = this.drawboard.to_img(this.init_zoom);
                const blob = this.base64_to_blob(base64);
                this.submit_handler({base64, blob});
            },

            /** 移动模式 */
            change_move_mode() {
                if (!this.drawboard) {
                    return;
                }
                this.in_move_mode = !this.in_move_mode;
                if (this.in_move_mode) {
                    this.drawboard.enable_select();
                } else {
                    this.button_clicked(this.current_button_index);
                }
            },

            /** 键盘事件-删除 */
            delete_handler(ev) {
                ev.preventDefault();
                ev.stopPropagation();

                // DEL 删除按钮
                if (ev.keyCode !== 46) {
                    return;
                }
                this.delete_selected();
            },

            /** 删除 */
            delete_selected() {
                if (!this.drawboard) {
                    return;
                }
                this.drawboard.delete_selected();
            },

            /** 设置文本 */
            async set_text(text = [''], angle = DEFAULT_ANGLE) {
                const top_padding = 15;
                const left_padding = 15;
                const bottom_padding = this.canvas_wh.width / 10;
                const font_size = DEFAULT_FONT_SIZE;
                const line_height = font_size * 2.5;

                if (is_array(text)) {
                    // 如果行数一屏展示不下需要设置 canvas 的高度
                    const need_line_count = text.length;
                    const max_line_count = Math.floor((this.draw_content_height - top_padding - bottom_padding) / line_height); // 一屏最大行数

                    if (need_line_count > max_line_count) {
                        this.canvas_wh.height = line_height * need_line_count + bottom_padding;
                    }

                    console.log(text);
                    console.log(`[绘制文本]
        canvas 高度:   ${ this.draw_content_height }
        总高:          ${ this.canvas_wh.height }
        行高:          ${ line_height }
        文字大小:       ${ font_size }
        一屏最大行数:   ${ max_line_count }
        文字总行数:     ${ need_line_count }
        bottomPadding: ${ bottom_padding }`);
                }

                await this.reset_canvas();
                if (!this.drawboard) {
                    return;
                }

                this.drawboard.set_text({
                    text: is_array(text) ? (text) : [text],
                    left: left_padding,
                    top: top_padding,
                    color: '#000',
                    font_size,
                    angle,
                });
                this.init_state.is_img = false;
                this.init_state.data = text;
            },

            /** 设置图片 */
            async set_img(src, angle = DEFAULT_ANGLE, imgcheck = true) {
                this.img_loading = true;
                // const img_src = network_url_replace_to_root_url(get_img_src_or_url(src));
                const img_src = src;
                console.log('draw_dialog url: ', src, img_src);

                const set_error_img = () => {
                    console.warn('drawing_board load image error ', img_src);
                    this.drawboard.set_text({text: ['图片加载失败:   ' + img_src], left: 15, top: 15, color: 'red'});
                };
                const finish = () => {
                    this.img_loading = false;
                };

                try {
                    let {width, height} = await get_image_natural_wh(img_src);
                    if (width < this.canvas_wh.width) {
                        width = this.canvas_wh.width;
                    }
                    if (height < this.canvas_wh.height) {
                        height = this.canvas_wh.height;
                    }

                    if (angle === 90 || angle === 270) {
                        const tempw = width;
                        width = height;
                        height = tempw;
                    }

                    let zoom = 1;
                    if (width > this.canvas_wh.width) {
                        zoom = this.canvas_wh.width / width;
                        height = height * zoom;
                    }
                    this.init_zoom = zoom;

                    if (height > this.draw_content_height) {
                        this.canvas_wh.height = height;
                    }

                    await this.reset_canvas();
                    if (!this.drawboard) {
                        finish();
                        return;
                    }
                    this.drawboard.set_bg_img({src: img_src, angle, catch: set_error_img, finish});
                    this.drawboard.set_min_zoom(0.2 * zoom);
                    this.drawboard.set_max_zoom(3 * zoom);
                    this.drawboard.set_zoom(zoom);
                } catch (err) {
                    this.reset_canvas();
                    set_error_img();
                    finish();
                }

                this.init_state.is_img = true;
                this.init_state.img_check = imgcheck;
                this.init_state.data = src;
            },

            /** 绘制 */
            draw(str, img = true) {
                const win_height = window.screen.height - 400;
                const win_width = document.body.clientWidth;
                this.canvas_wh = {width: win_width, height: win_height};
                this.draw_content_height = win_height;

                if (is_array(str)) {
                    this.set_text(str);
                    return;
                }
                const s = str;

                if (img) {
                    this.set_img(s);
                    return;
                }

                // 文本长度太长，自动换行
                const str_arr = [];
                // 根据 canvas 宽度得出一行容纳多少文字
                const max_font_count = Math.floor(this.canvas_wh.width / DEFAULT_FONT_SIZE);
                const LINE_CHARACHER_COUNT = max_font_count > (10 * 2) ? max_font_count - 10 : max_font_count;
                console.log('一行最大文字个数: ', LINE_CHARACHER_COUNT);
                if (s.length > LINE_CHARACHER_COUNT) {
                    const len = Math.ceil(s.length / LINE_CHARACHER_COUNT);
                    for (let i = 0; i < len; i++) {
                        const j = i * LINE_CHARACHER_COUNT;

                        if (i === (len - 1)) {
                            str_arr.push(s.slice(j));
                        } else {
                            str_arr.push(s.slice(j, (i + 1) * LINE_CHARACHER_COUNT));
                        }
                    }
                } else {
                    str_arr.push(s);
                }

                // 处理文本自带的换行 (性能很差的做法，1w字以下可以接受)
                const new_arr = [];
                str_arr.forEach((ss) => {
                    const word_line_break = ' '; // 一些 word 文本的换行符

                    if (ss.indexOf(word_line_break) !== -1) {
                        const bs = ss.split(word_line_break);
                        bs.forEach((b) => {
                            if (b) {
                                new_arr.push(b);
                            }
                        });
                    } else if (ss.indexOf('\r\n') !== -1) {
                        const bs = ss.split('\r\n');
                        bs.forEach((b) => {
                            if (b) {
                                new_arr.push(b);
                            }
                        });
                    } else if (ss.indexOf('\n') !== -1) {
                        const bs = ss.split('\n');
                        bs.forEach((b) => {
                            if (b) {
                                new_arr.push(b);
                            }
                        });
                    } else {
                        new_arr.push(ss);
                    }
                });

                this.set_text(new_arr);
            },

            /** 绘制初始状态 */
            draw_init_state() {
                if (this.init_state.is_img) {
                    this.set_img(this.init_state.data, this.rotate_angle, this.init_state.img_check);
                } else {
                    this.set_text(this.init_state.data, this.rotate_angle);
                }
            },

            /** 旋转 */
            async rotate() {
                if (!this.drawboard) {
                    return;
                }
                // const status = await confirm_message('旋转会重置绘图状态，是否确定');
                // if (!status) { return; }

                this.drawboard.clear();
                let r = this.rotate_angle;
                r += 90;
                if (r > 360) {
                    r = 0;
                }
                this.rotate_angle = r;
                this.draw_init_state();
            },

            /** 注册自定义绘图函数 */
            register_custom_draw_func() {
                if (!this.drawboard) {
                    return;
                }

                // 箭头
                register_arror_draw(this.btn_names[2], this.drawboard);
                // 勾
                register_right_draw(this.btn_names[8], this.drawboard);
                // 叉
                register_wrong_draw(this.btn_names[9], this.drawboard);
                // A+
                register_aplus_draw(this.btn_names[10], this.drawboard);
                // A-
                register_aminus_draw(this.btn_names[11], this.drawboard);

            },

            /** 将以 base64 数据转换为 Blob  */
            base64_to_blob(base64) {
                try {
                    const bytes = window.atob(base64.split(',')[1]);

                    // 处理异常,将 ascii 码小于 0 的转换为大于0
                    const ab = new ArrayBuffer(bytes.length);
                    const ia = new Uint8Array(ab);
                    for (let i = 0; i < bytes.length; i++) {
                        ia[i] = bytes.charCodeAt(i);
                    }

                    return new Blob([ab], {type: 'image/png'});
                } catch (err) {
                    return null;
                }
            },

            /** 按比例设置线宽和字体大小 */
            set_zoom_size() {
                if (!this.drawboard) {
                    return;
                }
                const zoom = this.zoom / 100;
                this.drawboard.set_brush({width: this.brush_width / zoom});
                this.drawboard.set_font_size(this.font_size / zoom);
                console.log(`'当前比例: ${ zoom }; 当前线宽: ${ this.brush_width }/${ this.brush_width / zoom }; 字体为: ${ this.font_size }/${ this.font_size / zoom }`);
            },

            /** 设置缩放比例 */
            set_zoom(plus) {
                if (!this.drawboard) {
                    return;
                }
                let zoom = this.zoom;
                if (plus) {
                    zoom += 20;
                } else {
                    zoom -= 20;
                }

                zoom = Math.ceil(zoom);
                if (zoom > 300) {
                    zoom = 300;
                }
                if (zoom < 20) {
                    zoom = 20;
                }

                this.zoom = zoom;
                const zoom_per = zoom / 100;
                this.drawboard.set_zoom(zoom_per * this.init_zoom, false, true);
                this.set_zoom_size();
            },

            rotate_dialog_submit() {
                if (this.rotate_dialog_checked) {
                    window.localStorage.setItem(ROTATE_DIALOG_KEY, ROTATE_DIALOG_VAL);
                }
                this.rotate();
                this.rotate_dialog = false;
            },

        }
    }


</script>
<style>
    .module_draw_dialog .module_draw_dialog_tip {
        position: absolute;
        top: -37px;
        left: 50%;
        margin-left: -230px;
        color: #66b1ff;
        font-size: 12px;
    }
    .module_draw_dialog .draw_wrapper {
        width: 100%;
        overflow-y: auto;
        background: rgba(0,0,0,0.1);
    }
    .module_draw_dialog .dialog_body {
        position: relative;
    }
    .module_draw_dialog .dialog_body .picker_item {
        position: relative;
    }
    .module_draw_dialog .dialog_body .picker_item .picker_title {
        vertical-align: middle;
        color: #595959;
        margin-right: 4px;
    }
    .module_draw_dialog .dialog_body .picker_item .el-color-picker {
        vertical-align: middle;
    }
    .module_draw_dialog .dialog_body .picker_item .el-color-picker__trigger {
        border: none;
        width: 70px;
    }
    .module_draw_dialog .dialog_body .picker_item .el-color-picker__color {
        width: 64px;
    }
    .module_draw_dialog .dialog_body .picker_item .el-color-picker__icon {
        left: 55px;
    }
    .module_draw_dialog .dialog_body .picker_item .picker_input {
        width: 64px;
        height: 24px;
        margin-left: 4px;
    }
    .module_draw_dialog .dialog_body .picker_item .picker_input .el-input-group__append {
        padding: 0 4px;
        color: #333;
        background-color: #ebebeb;
    }
    .module_draw_dialog .dialog_body .picker_item .picker_input input {
        height: 24px;
        line-height: 20px;
        padding: 4px;
        border: 1px solid #ccc;
    }
    .module_draw_dialog .dialog_body .picker_item .picker_slider {
        position: absolute;
        top: 24px;
        right: 0;
        width: 140px;
        padding: 0 14px;
        background-color: #ebebeb;
    }
    .module_draw_dialog .dialog_body .picker_item .picker_slider .el-slider {
        width: 112px;
    }
    .module_draw_dialog .dialog_body .picker_item .picker_slider .el-slider .el-slider__bar {
        background-color: #595959;
    }
    .module_draw_dialog .dialog_body .picker_item .picker_slider .el-slider .el-slider__button-wrapper .el-tooltip {
        border-color: #595959;
    }
    .module_draw_dialog .dialog_body .picker_item .picker_slider .el-slider .el-slider__runway {
        background-color: #ccc;
    }
    .module_draw_dialog .dialog_body .color_picker {
        position: absolute;
        top: 2px;
        right: 16px;
    }
    .module_draw_dialog .dialog_body .size_picker {
        position: absolute;
        top: 40px;
        right: 18px;
    }
    .module_draw_dialog .dialog_body .move_btn {
        position: absolute;
        bottom: 150px;
        right: 20px;
    }
    .module_draw_dialog .dialog_body .delete_btn {
        position: absolute;
        bottom: 110px;
        right: 20px;
    }
    .module_draw_dialog .dialog_body .zoom_text {
        position: absolute;
        bottom: 237px;
        right: 18px;
        font-size: 12px;
        -webkit-user-select: none;
        -moz-user-select: none;
        -ms-user-select: none;
        user-select: none;
    }
    .module_draw_dialog .dialog_body .zoom_in_btn,
    .module_draw_dialog .dialog_body .zoom_out_btn {
        position: absolute;
        bottom: 260px;
        right: 20px;
        font-size: 29px;
        color: #66b1ff;
        cursor: pointer;
    }
    .module_draw_dialog .dialog_body .zoom_in_btn:hover,
    .module_draw_dialog .dialog_body .zoom_out_btn:hover {
        opacity: 0.5;
    }
    .module_draw_dialog .dialog_body .zoom_out_btn {
        position: absolute;
        bottom: 200px;
        right: 20px;
    }
    .module_draw_dialog .draw_control {
        height: 90px;
        width: 100%;
        background-color: #66b1ff;
    }
    .module_draw_dialog .draw_control:after {
        display: block;
        content: ".";
        height: 0;
        line-height: 0;
        clear: both;
        visibility: hidden;
    }
    .module_draw_dialog .draw_control_item {
        height: 100%;
        float: left;
        text-align: center;
        color: #fff;
        font-weight: bolder;
        cursor: pointer;
        background-color: transparent;
    }
    .module_draw_dialog .draw_control_item img {
        display: block;
        margin: 0 auto;
    }
    .module_draw_dialog .draw_control_item:hover,
    .module_draw_dialog .draw_control_item.active {
        background-color: rgba(40,134,231,0.502);
    }
    .draw_rotate_dialog .el-dialog__header {
        padding: 20px 20px 10px 20px;
    }
    .draw_rotate_dialog .el-dialog__body {
        padding: 20px 20px;
    }
    .draw_rotate_dialog .draw_rotate_text {
        position: relative;
        padding-left: 50px;
        padding-bottom: 20px;
        line-height: 20px;
        font-size: 16px;
    }
    .draw_rotate_dialog .draw_rotate_text .el-icon-warning {
        position: absolute;
        top: 9px;
        left: 0;
        color: #faad14;
        font-size: 22px;
    }
    .draw_rotate_dialog .draw_rotate_checkbox {
        padding-left: 10px;
    }
</style>


