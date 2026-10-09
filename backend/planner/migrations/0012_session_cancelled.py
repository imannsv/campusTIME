from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [("planner", "0011_alter_room_capacity")]
    operations = [
        migrations.AddField(
            model_name="session", name="cancelled",
            field=models.BooleanField(default=False),
        ),
    ]
