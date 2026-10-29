# MURDGRID Volume 1 — GitHub Pages Interactive Viewer

**A working, static website demo using your real uploaded worked example (`KG-EX`).** No server, database, API keys, login, Node installation, or build step is required on GitHub Pages.

## What works now

- Case archive: search and filter cases by the five book levels; choose a case by direct URL.
- Investigation: real **BEFORE / AFTER** map, with original room coloring, wall boundaries, door openings, blocked **X1 / X2** cells, cast, victim, and clickable WORKING GRID.
- Working notes: mark route / exclude / question / erase; saved per case in the browser's local storage.
- Accusation: pick a suspect and an exact step; verify that answer without automatically showing the solution.
- Optional forensic clue: exam time and elapsed time from death, hidden by default.
- Spoiler-gated Reconstruction: synchronized frame player, play/pause, step backward/forward, range slider, four speeds, character filter, paths, event logs, and an explicit official-answer reveal.
- Larger view: expand BEFORE, AFTER, WORKING, or timeline map and zoom / pan.
- Missing assets: meaningful letter badges and furniture placeholders. Actual images will appear automatically when added later with the referenced filenames.
- Responsive layout for desktop, tablet, and mobile. All views use the same case JSON structure.

**The package only contains the ONE uploaded example, not 100 case JSON files.** The case catalogue will grow when you add the remaining 100 original JSONs and update `data/index.json`.

## Install on GitHub (giao diện GitHub Pages)

1. Tạo một repository công khai mới trên GitHub, ví dụ `murdgrid-viewer`.
2. **Giải nén ZIP này trên máy.** Upload **nội dung bên trong thư mục** (các file `index.html`, `app.js`, `styles.css`, thư mục `data`, v.v.) lên **thư mục gốc của repository**. Không chỉ upload riêng file ZIP.
3. Vào repository **Settings → Pages → Build and deployment → Source: Deploy from a branch**. Chọn branch **`main`** và folder **`/(root)`**, sau đó bấm **Save**.
4. Khi GitHub hoàn tất xuất bản, mở địa chỉ do GitHub Pages hiển thị. Đường dẫn sẽ có dạng `https://USERNAME.github.io/murdgrid-viewer/`. Đây chỉ là ví dụ, **không phải website đã được triển khai**.
5. Mở worked example qua `https://USERNAME.github.io/murdgrid-viewer/?case=KG-EX`.

**Test locally (optional):** open a terminal at the project root and run `python -m http.server 8000`, then visit `http://localhost:8000/`. Do not double-click `index.html` with a `file://` address; browsers block local JSON fetches.

## File tree

```text
murdgrid-github-demo/
├── index.html                   Web interface
├── styles.css                   Responsive styling
├── app.js                       Map renderer + synchronized player
├── favicon.svg
├── .nojekyll
├── README.md
├── tools/
│   └── build_index.py           Optional index creator / data checker
└── data/
    ├── index.json               Case list; required for archive discovery
    ├── KG-EX.json               REAL uploaded example data
    ├── certificates/
    │   └── KG-EX.json           REAL uploaded verification certificate
    └── assets/
        └── PLACE_ASSETS_HERE.txt
```

## Cách bổ sung đủ 100 puzzle

Theo README gốc của bạn, bộ dữ liệu đầy đủ có `index.json`, từng file case JSON, `certificates/` và `assets/`. Hãy **giải nén** gói dữ liệu gốc, rồi chép các tệp/thư mục bên trong sang **`data/`**, giữ nguyên quan hệ đường dẫn. Nếu bạn thay `data/index.json` bằng file gốc, website sẽ thử đọc nó qua nhiều tên trường thông dụng (`cases`, `puzzles`, `entries`; `file`, `json`, `path`, `data_file`, v.v.). Vì hiện chưa có index đầy đủ để kiểm chứng chính xác cấu trúc, cách ổn định nhất là dùng công cụ tạo index của dự án:

```bash
python tools/build_index.py
```

Chạy lệnh này ở thư mục gốc trên máy sau khi bạn đã chép toàn bộ JSON vào `data/`. Nó kiểm tra kích thước grid, thứ tự frames, số lượng bước, đồng bộ `actors[].path` với `frames[].positions`, và tạo lại `data/index.json` từ các case thực tế. Sau đó upload/commit toàn bộ `data/` lên GitHub. GitHub Pages sẽ tự dùng catalogue mới mà **không cần sửa `app.js`**.

Để chỉ kiểm tra mà không thay đổi index:

```bash
python tools/build_index.py --check
```

**Giữ nguyên** các đường dẫn tương đối trong dữ liệu, ví dụ `assets/KG-EX_A.png`, `assets/KG-EX-X2-01.png`, và `certificates/KG-EX.json`. Website tìm ảnh trong `data/assets/` và hiển thị placeholder khi chưa có ảnh. Nếu case files nằm trong `data/cases/` thì manifest sẽ trỏ đúng `cases/KG-001.json`, còn ảnh vẫn dùng `data/assets/`.

### Example of `data/index.json`

```json
{
  "schema_version": "murdgrid-site-index-1",
  "cases": [
    {
      "id": "KG-EX",
      "title": "The Last Toast",
      "level": 0,
      "file": "KG-EX.json"
    },
    {
      "id": "KG-001",
      "title": "YOUR ACTUAL CASE TITLE",
      "level": 1,
      "file": "cases/KG-001.json"
    }
  ]
}
```

`KG-001` above is **only an illustrative index entry**; this demo does not include such a JSON file. Do not add it to `index.json` until the corresponding file exists.

## Permanent QR code URLs / spoiler considerations

After uploading and testing your entire dataset, use a stable query URL for each case:

```text
https://USERNAME.github.io/murdgrid-viewer/?case=KG-EX
https://USERNAME.github.io/murdgrid-viewer/?case=KG-001
```

This demo **does not generate QR codes**, does not claim your QR pages have been published, and does not modify the empty placeholders in your PDF. Decide on the final GitHub username / repository name first, then create QR codes only after deployment.

**Important:** case JSONs contain `answer`, `frames`, and paths in the public page source. Hiding reconstruction and showing a spoiler gate is a **reader-experience feature, not cryptographic access control**. Everyone who can access the public site can download the full answer JSON. If you later need secrets protected from technical users, you will need a server-side architecture or separate public and solution datasets.

## Data consistency / interpretation

- Coordinates `A1` through the grid size: letters = columns, digits = rows.
- `grid.room_ids` defines room cells; `grid.doors` defines real openings. We NEVER invent a connection between rooms.
- The `grid.outer_door` remains blocked for movement (shown as an architectural indication, not an exit).
- Objects block all cells in `objects[].cells`; X2 sprites cover both cells.
- Synchronized `frames` and `events` drive playback; `actors[].path` drives trails.
- The victim stops at the scene after death; **other characters move on the same clock**.
- The book's verified unique answer is the **(murderer, death_step) pair**, not an assertion of a unique path for each actor.
- The example certificate `data/certificates/KG-EX.json` is included faithfully but the website does not independently redo the BFS audit; it reads the `validation` summary in the case data.

## Rights / technical notes

The code and visual design here are newly authored for this GitHub demo. Uploaded case data and future supplied images remain your book's materials. The client uses vanilla HTML, CSS, and JavaScript without runtime frameworks. Google Fonts are optional; system-font fallbacks work offline. This demo has not been deployed to a live GitHub account.

