import json
from quart import Quart, render_template, request, jsonify, redirect, url_for, Response

from backend.database import (
    init_db, get_character, save_character,
    create_character, list_characters, archive_character,
)
from backend.import_export import import_character, export_character
from backend.dice import parse_and_roll

app = Quart(__name__)
app.config['SEND_FILE_MAX_AGE_DEFAULT'] = 0


@app.before_serving
async def startup():
    await init_db()


@app.route("/")
async def index():
    chars = await list_characters()
    if not chars:
        char = await create_character("Personagem")
        return redirect(url_for("character_page", char_id=char["id"]))
    if len(chars) == 1:
        return redirect(url_for("character_page", char_id=chars[0]["id"]))
    return await render_template("index.html", characters=chars)


@app.route("/character/new", methods=["POST"])
async def new_character():
    form = await request.form
    name = form.get("name", "Personagem") or "Personagem"
    char = await create_character(name)
    return redirect(url_for("character_page", char_id=char["id"]))


@app.route("/character/<char_id>")
async def character_page(char_id: str):
    char = await get_character(char_id)
    if not char:
        return "Personagem não encontrado", 404
    chars = await list_characters()
    return await render_template("character.html", character=char, characters=chars)


@app.route("/api/character", methods=["GET"])
async def api_list():
    return jsonify(await list_characters())


@app.route("/api/character/<char_id>", methods=["GET"])
async def api_get(char_id: str):
    char = await get_character(char_id)
    if not char:
        return jsonify({"error": "Personagem não encontrado"}), 404
    return jsonify(char)


@app.route("/api/character/<char_id>", methods=["PUT"])
async def api_update(char_id: str):
    data = await request.get_json()
    if not data:
        return jsonify({"error": "Dados inválidos"}), 400
    data["id"] = char_id
    saved = await save_character(data)
    return jsonify({"ok": True, "updated_at": saved.get("updated_at", "")})


@app.route("/api/character/<char_id>", methods=["DELETE"])
async def api_archive(char_id: str):
    await archive_character(char_id)
    return jsonify({"ok": True})


@app.route("/api/character/<char_id>/export", methods=["GET"])
async def api_export(char_id: str):
    char = await get_character(char_id)
    if not char:
        return jsonify({"error": "Personagem não encontrado"}), 404
    json_data = export_character(char)
    safe_name = char.get("name", "personagem").lower().replace(" ", "_")
    return Response(
        json_data,
        mimetype="application/json",
        headers={"Content-Disposition": f'attachment; filename="{safe_name}.json"'},
    )


@app.route("/api/character/import", methods=["POST"])
async def api_import():
    files = await request.files
    if "file" in files:
        raw = (await files["file"].read()).decode("utf-8")
    else:
        body = await request.get_json()
        if not body:
            return jsonify({"error": "Nenhum arquivo enviado"}), 400
        raw = json.dumps(body)

    char, errors = import_character(raw)
    if errors:
        return jsonify({"error": "Importação inválida", "details": errors}), 400

    await save_character(char)
    return jsonify({"ok": True, "id": char["id"], "name": char["name"]})


@app.route("/api/character/<char_id>/parse-sheet", methods=["POST"])
async def api_parse_sheet(char_id: str):
    from backend.sheet_parser import parse_text, parse_image, parse_pdf

    try:
        files = await request.files
        form  = await request.form

        if "file" in files:
            f    = files["file"]
            data = f.read()
            name = (f.filename or "").lower()

            if name.endswith(".pdf"):
                parsed = await parse_pdf(data)
            elif name.endswith(".png"):
                parsed = await parse_image(data, "image/png")
            elif name.endswith((".jpg", ".jpeg")):
                parsed = await parse_image(data, "image/jpeg")
            elif name.endswith(".webp"):
                parsed = await parse_image(data, "image/webp")
            else:
                return jsonify({"error": "Formato não suportado. Use PDF, PNG, JPG ou WEBP."}), 400

        else:
            body = await request.get_json(silent=True) or {}
            text = body.get("text") or form.get("text", "")
            if not text.strip():
                return jsonify({"error": "Envie um arquivo (PDF/imagem) ou cole o texto da ficha."}), 400
            parsed = await parse_text(text)

        return jsonify({"ok": True, "data": parsed})

    except ValueError as exc:
        return jsonify({"error": str(exc)}), 400
    except Exception as exc:
        return jsonify({"error": f"Erro ao processar ficha: {exc}"}), 500


@app.route("/api/roll", methods=["POST"])
async def api_roll():
    data = await request.get_json()
    expression = (data or {}).get("expression", "1d20")
    return jsonify(parse_and_roll(expression))


if __name__ == "__main__":
    app.run(debug=True, host="127.0.0.1", port=5000)
