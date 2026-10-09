SITE = "https://baresudoku.com"
NAME = "Bare Sudoku"
AUTHOR = "Alparslan Selçuk Develioğlu"
AUTHOR_URL = "https://devdiscipline.com/about"
AUTHOR_LINKS = [
    ("LinkedIn", "https://www.linkedin.com/in/alparslandev/"),
    ("Instagram", "https://www.instagram.com/alparslandev"),
    ("DevDiscipline", "https://devdiscipline.com"),
    ("Yarış Radarı", "https://yarisradari.com"),
]
PERSON_ID = SITE + "/#person"
WEBSITE_ID = SITE + "/#website"
GAME_ID = SITE + "/#game"
WEB_REPO = "https://github.com/alparslandev/baresudoku-web"
ANDROID_REPO = "https://github.com/alparslandev/baresudoku"
ALTERNATIVETO = "https://alternativeto.net/software/bare-sudoku/"
TEST_GROUP = ""
TEST_OPTIN = "https://play.google.com/apps/testing/com.baresudoku"
OG_IMAGE = SITE + "/og.png"
SAME_AS = ["https://github.com/alparslandev"] + [url for _, url in AUTHOR_LINKS] + ["https://www.youtube.com/@alparslandev"]
OG_LOCALES = {
    "en": "en_US", "tr": "tr_TR", "az": "az_AZ", "de": "de_DE", "fr": "fr_FR", "es": "es_ES", "pt": "pt_PT", "it": "it_IT",
    "nl": "nl_NL", "pl": "pl_PL", "cs": "cs_CZ", "sk": "sk_SK", "hu": "hu_HU", "ro": "ro_RO", "el": "el_GR", "sv": "sv_SE",
    "da": "da_DK", "nb": "nb_NO", "fi": "fi_FI", "ru": "ru_RU", "uk": "uk_UA", "bg": "bg_BG", "sr": "sr_RS", "hr": "hr_HR",
    "ar": "ar_AR", "fa": "fa_IR", "he": "he_IL", "hi": "hi_IN", "bn": "bn_BD", "id": "id_ID", "ms": "ms_MY", "vi": "vi_VN",
    "th": "th_TH", "ja": "ja_JP", "ko": "ko_KR", "zh-Hans": "zh_CN", "zh-Hant": "zh_TW",
    "ur": "ur_PK", "pa": "pa_IN", "ta": "ta_IN", "te": "te_IN", "mr": "mr_IN", "gu": "gu_IN", "kn": "kn_IN", "ml": "ml_IN",
    "tl": "tl_PH", "jv": "jv_ID", "sw": "sw_KE", "my": "my_MM", "ca": "ca_ES", "sl": "sl_SI", "lt": "lt_LT", "lv": "lv_LV",
    "et": "et_EE", "sq": "sq_AL", "mk": "mk_MK", "bs": "bs_BA", "ka": "ka_GE", "hy": "hy_AM", "kk": "kk_KZ", "uz": "uz_UZ",
    "ky": "ky_KG", "tg": "tg_TJ", "mn": "mn_MN", "ne": "ne_NP", "si": "si_LK", "km": "km_KH", "lo": "lo_LA", "am": "am_ET",
    "ha": "ha_NG", "yo": "yo_NG", "ig": "ig_NG", "zu": "zu_ZA", "af": "af_ZA", "is": "is_IS", "ga": "ga_IE", "cy": "cy_GB",
    "eu": "eu_ES", "gl": "gl_ES", "mt": "mt_MT", "lb": "lb_LU", "be": "be_BY", "so": "so_SO", "xh": "xh_ZA", "ht": "ht_HT",
    "eo": "eo_EO", "la": "la_VA", "yi": "yi_DE", "ps": "ps_AF", "ku": "ku_TR", "ckb": "ckb_IQ", "ug": "ug_CN", "sd": "sd_PK",
    "tk": "tk_TM", "tt": "tt_RU", "ba": "ba_RU", "mi": "mi_NZ", "sm": "sm_WS", "to": "to_TO", "haw": "haw_US", "fj": "fj_FJ",
    "or": "or_IN", "as": "as_IN", "dv": "dv_MV", "ceb": "ceb_PH", "su": "su_ID", "st": "st_ZA", "sn": "sn_ZW", "rw": "rw_RW",
    "mg": "mg_MG", "ny": "ny_MW", "ti": "ti_ET", "om": "om_ET", "wo": "wo_SN", "ln": "ln_CD", "tn": "tn_BW", "ts": "ts_ZA",
    "lg": "lg_UG", "ak": "ak_GH", "ee": "ee_GH", "fo": "fo_FO", "gd": "gd_GB", "br": "br_FR", "oc": "oc_FR", "fy": "fy_NL",
    "qu": "qu_PE", "gn": "gn_PY", "ay": "ay_BO", "hmn": "hmn_US", "cv": "cv_RU", "os": "os_RU", "ce": "ce_RU",
}


def og_locale(code):
    if code in OG_LOCALES:
        return OG_LOCALES[code]
    base = code.split("-")[0].lower()
    return base + "_" + code.split("-")[-1].upper()
