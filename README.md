<img width="1280" height="800" alt="playground screenshot" src="https://github.com/user-attachments/assets/273dfdb5-e5d3-48c6-a30b-be272b73e922" />

# oai-tts-router

a **Free** TTS Router.

## 快速开始

```bash
git clone https://github.com/lenML/oai-tts-router.git
cd oai-tts-router
docker compose up -d
# 访问 http://localhost:17777/playground/
```

### 调用

```ts
import fs from 'fs';
import path from 'path';
import OpenAI from 'openai';

const openai = new OpenAI();

const speechFile = path.resolve('./speech.mp3');

async function main() {
  const mp3 = await openai.audio.speech.create({
    model: 'edge-tts',
    voice: 'zh-CN-XiaoxiaoNeural',
    input: 'oai-tts-router项目可以满足你对tts服务的基础需求，极速且免费。',
  });
  console.log(speechFile);
  const buffer = Buffer.from(await mp3.arrayBuffer());
  await fs.promises.writeFile(speechFile, buffer);
}
main();
```

可用模型和对应 voices 通过 `GET /v1/models` 获取。

```bash
# 列出所有模型及其支持的 voice
curl http://localhost:17777/v1/models -H "Authorization: Bearer sk-your-api-key"
```

<details>
  <summary>Available Voices</summary>

```json
{
  "object": "list",
  "data": [
    {
      "id": "google-translate",
      "object": "model",
      "created": 1715000000,
      "owned_by": "google-translate",
      "supported_voices": []
    },
    {
      "id": "edge-tts",
      "object": "model",
      "created": 1715000000,
      "owned_by": "microsoft",
      "supported_voices": [
        "af-ZA-AdriNeural",
        "af-ZA-WillemNeural",
        "am-ET-AmehaNeural",
        "am-ET-MekdesNeural",
        "ar-AE-FatimaNeural",
        "ar-AE-HamdanNeural",
        "ar-BH-AliNeural",
        "ar-BH-LailaNeural",
        "ar-DZ-AminaNeural",
        "ar-DZ-IsmaelNeural",
        "ar-EG-SalmaNeural",
        "ar-EG-ShakirNeural",
        "ar-IQ-BasselNeural",
        "ar-IQ-RanaNeural",
        "ar-JO-SanaNeural",
        "ar-JO-TaimNeural",
        "ar-KW-FahedNeural",
        "ar-KW-NouraNeural",
        "ar-LB-LaylaNeural",
        "ar-LB-RamiNeural",
        "ar-LY-ImanNeural",
        "ar-LY-OmarNeural",
        "ar-MA-JamalNeural",
        "ar-MA-MounaNeural",
        "ar-OM-AbdullahNeural",
        "ar-OM-AyshaNeural",
        "ar-QA-AmalNeural",
        "ar-QA-MoazNeural",
        "ar-SA-HamedNeural",
        "ar-SA-ZariyahNeural",
        "ar-SY-AmanyNeural",
        "ar-SY-LaithNeural",
        "ar-TN-HediNeural",
        "ar-TN-ReemNeural",
        "ar-YE-MaryamNeural",
        "ar-YE-SalehNeural",
        "az-AZ-BabekNeural",
        "az-AZ-BanuNeural",
        "bg-BG-BorislavNeural",
        "bg-BG-KalinaNeural",
        "bn-BD-NabanitaNeural",
        "bn-BD-PradeepNeural",
        "bn-IN-BashkarNeural",
        "bn-IN-TanishaaNeural",
        "bs-BA-GoranNeural",
        "bs-BA-VesnaNeural",
        "ca-ES-EnricNeural",
        "ca-ES-JoanaNeural",
        "cs-CZ-AntoninNeural",
        "cs-CZ-VlastaNeural",
        "cy-GB-AledNeural",
        "cy-GB-NiaNeural",
        "da-DK-ChristelNeural",
        "da-DK-JeppeNeural",
        "de-AT-IngridNeural",
        "de-AT-JonasNeural",
        "de-CH-JanNeural",
        "de-CH-LeniNeural",
        "de-DE-AmalaNeural",
        "de-DE-ConradNeural",
        "de-DE-FlorianMultilingualNeural",
        "de-DE-KatjaNeural",
        "de-DE-KillianNeural",
        "de-DE-SeraphinaMultilingualNeural",
        "el-GR-AthinaNeural",
        "el-GR-NestorasNeural",
        "en-AU-NatashaNeural",
        "en-AU-WilliamMultilingualNeural",
        "en-CA-ClaraNeural",
        "en-CA-LiamNeural",
        "en-GB-LibbyNeural",
        "en-GB-MaisieNeural",
        "en-GB-RyanNeural",
        "en-GB-SoniaNeural",
        "en-GB-ThomasNeural",
        "en-HK-SamNeural",
        "en-HK-YanNeural",
        "en-IE-ConnorNeural",
        "en-IE-EmilyNeural",
        "en-IN-NeerjaExpressiveNeural",
        "en-IN-NeerjaNeural",
        "en-IN-PrabhatNeural",
        "en-KE-AsiliaNeural",
        "en-KE-ChilembaNeural",
        "en-NG-AbeoNeural",
        "en-NG-EzinneNeural",
        "en-NZ-MitchellNeural",
        "en-NZ-MollyNeural",
        "en-PH-JamesNeural",
        "en-PH-RosaNeural",
        "en-SG-LunaNeural",
        "en-SG-WayneNeural",
        "en-TZ-ElimuNeural",
        "en-TZ-ImaniNeural",
        "en-US-AnaNeural",
        "en-US-AndrewMultilingualNeural",
        "en-US-AndrewNeural",
        "en-US-AriaNeural",
        "en-US-AvaMultilingualNeural",
        "en-US-AvaNeural",
        "en-US-BrianMultilingualNeural",
        "en-US-BrianNeural",
        "en-US-ChristopherNeural",
        "en-US-EmmaMultilingualNeural",
        "en-US-EmmaNeural",
        "en-US-EricNeural",
        "en-US-GuyNeural",
        "en-US-JennyNeural",
        "en-US-MichelleNeural",
        "en-US-RogerNeural",
        "en-US-SteffanNeural",
        "en-ZA-LeahNeural",
        "en-ZA-LukeNeural",
        "es-AR-ElenaNeural",
        "es-AR-TomasNeural",
        "es-BO-MarceloNeural",
        "es-BO-SofiaNeural",
        "es-CL-CatalinaNeural",
        "es-CL-LorenzoNeural",
        "es-CO-GonzaloNeural",
        "es-CO-SalomeNeural",
        "es-CR-JuanNeural",
        "es-CR-MariaNeural",
        "es-CU-BelkysNeural",
        "es-CU-ManuelNeural",
        "es-DO-EmilioNeural",
        "es-DO-RamonaNeural",
        "es-EC-AndreaNeural",
        "es-EC-LuisNeural",
        "es-ES-AlvaroNeural",
        "es-ES-ElviraNeural",
        "es-ES-XimenaNeural",
        "es-GQ-JavierNeural",
        "es-GQ-TeresaNeural",
        "es-GT-AndresNeural",
        "es-GT-MartaNeural",
        "es-HN-CarlosNeural",
        "es-HN-KarlaNeural",
        "es-MX-DaliaNeural",
        "es-MX-JorgeNeural",
        "es-NI-FedericoNeural",
        "es-NI-YolandaNeural",
        "es-PA-MargaritaNeural",
        "es-PA-RobertoNeural",
        "es-PE-AlexNeural",
        "es-PE-CamilaNeural",
        "es-PR-KarinaNeural",
        "es-PR-VictorNeural",
        "es-PY-MarioNeural",
        "es-PY-TaniaNeural",
        "es-SV-LorenaNeural",
        "es-SV-RodrigoNeural",
        "es-US-AlonsoNeural",
        "es-US-PalomaNeural",
        "es-UY-MateoNeural",
        "es-UY-ValentinaNeural",
        "es-VE-PaolaNeural",
        "es-VE-SebastianNeural",
        "et-EE-AnuNeural",
        "et-EE-KertNeural",
        "fa-IR-DilaraNeural",
        "fa-IR-FaridNeural",
        "fi-FI-HarriNeural",
        "fi-FI-NooraNeural",
        "fil-PH-AngeloNeural",
        "fil-PH-BlessicaNeural",
        "fr-BE-CharlineNeural",
        "fr-BE-GerardNeural",
        "fr-CA-AntoineNeural",
        "fr-CA-JeanNeural",
        "fr-CA-SylvieNeural",
        "fr-CA-ThierryNeural",
        "fr-CH-ArianeNeural",
        "fr-CH-FabriceNeural",
        "fr-FR-DeniseNeural",
        "fr-FR-EloiseNeural",
        "fr-FR-HenriNeural",
        "fr-FR-RemyMultilingualNeural",
        "fr-FR-VivienneMultilingualNeural",
        "ga-IE-ColmNeural",
        "ga-IE-OrlaNeural",
        "gl-ES-RoiNeural",
        "gl-ES-SabelaNeural",
        "gu-IN-DhwaniNeural",
        "gu-IN-NiranjanNeural",
        "he-IL-AvriNeural",
        "he-IL-HilaNeural",
        "hi-IN-MadhurNeural",
        "hi-IN-SwaraNeural",
        "hr-HR-GabrijelaNeural",
        "hr-HR-SreckoNeural",
        "hu-HU-NoemiNeural",
        "hu-HU-TamasNeural",
        "id-ID-ArdiNeural",
        "id-ID-GadisNeural",
        "is-IS-GudrunNeural",
        "is-IS-GunnarNeural",
        "it-IT-DiegoNeural",
        "it-IT-ElsaNeural",
        "it-IT-GiuseppeMultilingualNeural",
        "it-IT-IsabellaNeural",
        "iu-Cans-CA-SiqiniqNeural",
        "iu-Cans-CA-TaqqiqNeural",
        "iu-Latn-CA-SiqiniqNeural",
        "iu-Latn-CA-TaqqiqNeural",
        "ja-JP-KeitaNeural",
        "ja-JP-NanamiNeural",
        "jv-ID-DimasNeural",
        "jv-ID-SitiNeural",
        "ka-GE-EkaNeural",
        "ka-GE-GiorgiNeural",
        "kk-KZ-AigulNeural",
        "kk-KZ-DauletNeural",
        "km-KH-PisethNeural",
        "km-KH-SreymomNeural",
        "kn-IN-GaganNeural",
        "kn-IN-SapnaNeural",
        "ko-KR-HyunsuMultilingualNeural",
        "ko-KR-InJoonNeural",
        "ko-KR-SunHiNeural",
        "lo-LA-ChanthavongNeural",
        "lo-LA-KeomanyNeural",
        "lt-LT-LeonasNeural",
        "lt-LT-OnaNeural",
        "lv-LV-EveritaNeural",
        "lv-LV-NilsNeural",
        "mk-MK-AleksandarNeural",
        "mk-MK-MarijaNeural",
        "ml-IN-MidhunNeural",
        "ml-IN-SobhanaNeural",
        "mn-MN-BataaNeural",
        "mn-MN-YesuiNeural",
        "mr-IN-AarohiNeural",
        "mr-IN-ManoharNeural",
        "ms-MY-OsmanNeural",
        "ms-MY-YasminNeural",
        "mt-MT-GraceNeural",
        "mt-MT-JosephNeural",
        "my-MM-NilarNeural",
        "my-MM-ThihaNeural",
        "nb-NO-FinnNeural",
        "nb-NO-PernilleNeural",
        "ne-NP-HemkalaNeural",
        "ne-NP-SagarNeural",
        "nl-BE-ArnaudNeural",
        "nl-BE-DenaNeural",
        "nl-NL-ColetteNeural",
        "nl-NL-FennaNeural",
        "nl-NL-MaartenNeural",
        "pl-PL-MarekNeural",
        "pl-PL-ZofiaNeural",
        "ps-AF-GulNawazNeural",
        "ps-AF-LatifaNeural",
        "pt-BR-AntonioNeural",
        "pt-BR-FranciscaNeural",
        "pt-BR-ThalitaMultilingualNeural",
        "pt-PT-DuarteNeural",
        "pt-PT-RaquelNeural",
        "ro-RO-AlinaNeural",
        "ro-RO-EmilNeural",
        "ru-RU-DmitryNeural",
        "ru-RU-SvetlanaNeural",
        "si-LK-SameeraNeural",
        "si-LK-ThiliniNeural",
        "sk-SK-LukasNeural",
        "sk-SK-ViktoriaNeural",
        "sl-SI-PetraNeural",
        "sl-SI-RokNeural",
        "so-SO-MuuseNeural",
        "so-SO-UbaxNeural",
        "sq-AL-AnilaNeural",
        "sq-AL-IlirNeural",
        "sr-RS-NicholasNeural",
        "sr-RS-SophieNeural",
        "su-ID-JajangNeural",
        "su-ID-TutiNeural",
        "sv-SE-MattiasNeural",
        "sv-SE-SofieNeural",
        "sw-KE-RafikiNeural",
        "sw-KE-ZuriNeural",
        "sw-TZ-DaudiNeural",
        "sw-TZ-RehemaNeural",
        "ta-IN-PallaviNeural",
        "ta-IN-ValluvarNeural",
        "ta-LK-KumarNeural",
        "ta-LK-SaranyaNeural",
        "ta-MY-KaniNeural",
        "ta-MY-SuryaNeural",
        "ta-SG-AnbuNeural",
        "ta-SG-VenbaNeural",
        "te-IN-MohanNeural",
        "te-IN-ShrutiNeural",
        "th-TH-NiwatNeural",
        "th-TH-PremwadeeNeural",
        "tr-TR-AhmetNeural",
        "tr-TR-EmelNeural",
        "uk-UA-OstapNeural",
        "uk-UA-PolinaNeural",
        "ur-IN-GulNeural",
        "ur-IN-SalmanNeural",
        "ur-PK-AsadNeural",
        "ur-PK-UzmaNeural",
        "uz-UZ-MadinaNeural",
        "uz-UZ-SardorNeural",
        "vi-VN-HoaiMyNeural",
        "vi-VN-NamMinhNeural",
        "zh-CN-XiaoxiaoNeural",
        "zh-CN-XiaoyiNeural",
        "zh-CN-YunjianNeural",
        "zh-CN-YunxiNeural",
        "zh-CN-YunxiaNeural",
        "zh-CN-YunyangNeural",
        "zh-CN-liaoning-XiaobeiNeural",
        "zh-CN-shaanxi-XiaoniNeural",
        "zh-HK-HiuGaaiNeural",
        "zh-HK-HiuMaanNeural",
        "zh-HK-WanLungNeural",
        "zh-TW-HsiaoChenNeural",
        "zh-TW-HsiaoYuNeural",
        "zh-TW-YunJheNeural",
        "zu-ZA-ThandoNeural",
        "zu-ZA-ThembaNeural"
      ]
    },
    {
      "id": "openai-fm-tts",
      "object": "model",
      "created": 1715000000,
      "owned_by": "openai-fm",
      "supported_voices": [
        "alloy",
        "ash",
        "ballad",
        "coral",
        "echo",
        "fable",
        "nova",
        "onyx",
        "sage",
        "shimmer",
        "verse"
      ]
    }
  ]
}
```

</details>

## 内置模型

| model              | 后端                 | 说明                                                             |
| ------------------ | -------------------- | ---------------------------------------------------------------- |
| `google-translate` | Google Translate TTS | 极速生成，自动识别语言，可用 extra 参数指定语音，没有 voice 切换 |
| `edge-tts`         | Edge TTS             | 320+ 种声音，支持 `rate`/`pitch`/`volume` 参数                   |
| `openai-fm-tts`    | OpenAI.fm            | 与 OpenAI TTS API 相同的 11 种声音                               |

每个模型支持的 `voice` 通过 `GET /v1/models` 获取。

## 鉴权

设置 `API_KEY` 环境变量：

```
API_KEY=sk-my-secret-key,sk-another-key
```

- API 请求：`Authorization: Bearer <key>`
- Playground：HTTP Basic Auth，密码填任意一个 key （用户名忽略）
- 不设 `API_KEY`：完全开放

## 配置

| 变量             | 默认值 | 说明                           |
| ---------------- | ------ | ------------------------------ |
| `PORT`           | `3000` | 监听端口                       |
| `API_KEY`        | -      | 鉴权 key，逗号分隔             |
| `TTS_CACHE_SIZE` | `0`    | 缓存大小，如 `100mb`，`0` 禁用 |
| `HTTP_PROXY`     | -      | 出站 HTTP 代理                 |
| `HTTPS_PROXY`    | -      | 出站 HTTPS 代理                |

## Playground

内置网页调试工具，路径 `/playground/`。可切换模型、声音、语速、输出格式，实时试听。

如果配置了 API_KEY 页面受 Basic Auth 保护，密码填 API_KEY ，用户名随便。

## 本地开发

```bash
pnpm install
pnpm dev      # 热重载
pnpm build
pnpm start
```

Docker 开发：

```bash
docker compose --profile dev up -d
```
