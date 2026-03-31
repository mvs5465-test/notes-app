from flask import Flask, abort, jsonify, redirect, render_template, request, url_for

from models import create_note, delete_note, get_note, init_db, list_notes, update_note


def create_app():
    app = Flask(__name__)
    init_db()

    def parse_json_body():
        payload = request.get_json(silent=True)
        if not isinstance(payload, dict) or "body" not in payload:
            abort(json_error("Request body must be JSON with a 'body' field.", 400))
        return payload["body"]

    def note_summary(note):
        snippet = " ".join(note["body"].split())
        return {
            "id": note["id"],
            "title": note["title"],
            "snippet": snippet[:140],
            "updated_at": note["updated_at"],
        }

    @app.route("/", methods=["GET"])
    def index():
        edit_note = None
        edit_id = request.args.get("edit", type=int)
        if edit_id is not None:
            edit_note = get_note(edit_id)
            if edit_note is None:
                abort(404)

        return render_template(
            "index.html",
            notes=list_notes(),
            edit_note=edit_note,
        )

    @app.route("/notes", methods=["POST"])
    def create_note_route():
        body = request.form.get("body", "")
        create_note(body)
        return redirect(url_for("index"))

    @app.route("/notes/<int:note_id>/update", methods=["POST"])
    def update_note_route(note_id):
        body = request.form.get("body", "")
        updated = update_note(note_id, body)
        if not updated:
            abort(404)
        return redirect(url_for("index"))

    @app.route("/notes/<int:note_id>/delete", methods=["POST"])
    def delete_note_route(note_id):
        deleted = delete_note(note_id)
        if not deleted:
            abort(404)
        return redirect(url_for("index"))

    @app.route("/api/notes", methods=["GET"])
    def list_notes_api():
        notes = [note_summary(note) for note in list_notes()]
        return jsonify(notes)

    @app.route("/api/notes/<int:note_id>", methods=["GET"])
    def get_note_api(note_id):
        note = get_note(note_id)
        if note is None:
            return jsonify({"error": "Note not found."}), 404
        return jsonify(note)

    @app.route("/api/notes", methods=["POST"])
    def create_note_api():
        body = parse_json_body()
        note = create_note(body)
        return jsonify(note), 201

    @app.route("/api/notes/<int:note_id>", methods=["PUT"])
    def update_note_api(note_id):
        body = parse_json_body()
        note = update_note(note_id, body)
        if note is None:
            return jsonify({"error": "Note not found."}), 404
        return jsonify(note)

    @app.route("/api/notes/<int:note_id>", methods=["DELETE"])
    def delete_note_api(note_id):
        deleted = delete_note(note_id)
        if not deleted:
            return jsonify({"error": "Note not found."}), 404
        return jsonify({"deleted": True, "id": note_id})

    return app


app = create_app()


if __name__ == "__main__":
    app.run(debug=True)


def json_error(message, status_code):
    response = jsonify({"error": message})
    response.status_code = status_code
    return response
