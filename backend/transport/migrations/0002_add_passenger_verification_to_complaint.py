# Generated migration file
# Save this as: transport/migrations/0002_add_passenger_verification_to_complaint.py

from django.db import migrations, models

class Migration(migrations.Migration):

    dependencies = [
        ('transport', '0006_complaint_is_verified_complaint_issue_photo_and_more'),  # Update this to your last migration
    ]

    operations = [
        migrations.AddField(
            model_name='complaint',
            name='passenger_name',
            field=models.CharField(default='', help_text='Name of the actual passenger who is complaining', max_length=200),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='complaint',
            name='passenger_phone',
            field=models.CharField(default='', help_text='Phone number of the actual passenger (must match booking)', max_length=15),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='complaint',
            name='seat_number',
            field=models.CharField(blank=True, help_text='Seat number of the complaining passenger', max_length=10, null=True),
        ),
    ]